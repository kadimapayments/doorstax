/**
 * Scheduled-payment executor.
 *
 * Called by /api/cron/process-scheduled-payments once per day for every
 * ScheduledPayment row that's due (scheduledDate <= now), still
 * unexecuted, and below the attempt cap. Mirrors the card / ACH paths
 * from /api/payments/charge but auto-picks the method based on the
 * tenant's saved default at execution time (so an updated card works
 * without rescheduling).
 *
 * Why a lib function and not an internal HTTP call:
 *   - Avoids a self-fetch + re-auth dance from the cron context.
 *   - Cron has no `resolveApiLandlord` session — we already have the
 *     landlordId on the row.
 *   - Result shape is purpose-built for cron retry logic (`retry:
 *     boolean` + reason) rather than HTTP status codes.
 *
 * Method selection (locked-in: "Auto-pick saved default at execution
 * time" from the design Q&A):
 *   1. ACH if kadimaCustomerId + kadimaAccountId — preferred (cheaper
 *      for the landlord, lines up with autopay defaults).
 *   2. Card if kadimaCustomerId + kadimaCardTokenId.
 *   3. Neither → fail with retry: true (we'll try again tomorrow in
 *      case the tenant adds a method between now and then).
 *
 * Cash and check are deliberately blocked — a cron can't physically
 * receive cash, and the schedule form rejects them at submit time.
 *
 * Failure semantics (locked-in: "mix of marked-failed-and-notify +
 * retry max 3 attempts"):
 *   - Returns `{ ok: false, retry: true, ... }` for transient cases
 *     (no method on file, gateway error). Cron bumps `attempts` and
 *     retries tomorrow. Final attempt flips `executed=true` to mark
 *     terminal failure.
 *   - Returns `{ ok: false, retry: false, ... }` for hard failures
 *     (property not approved, merchant not approved). Cron flips
 *     `executed=true` immediately and burns no more retries.
 *   - Gateway DECLINE (insufficient funds, etc.) is `retry: true` —
 *     paycheck might land tomorrow.
 */

import { db } from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";
import { getMerchantCredentials } from "@/lib/kadima/merchant-context";
import { merchantCreateSaleFromVault } from "@/lib/kadima/merchant-gateway";
import { merchantCreateAchDebit } from "@/lib/kadima/merchant-ach";
import { checkMerchantApproval } from "@/lib/kadima/merchant-guard";
import { assertUnitPropertyApproved } from "@/lib/property-guard";
import { pickSecCode } from "@/lib/kadima/sec-code";
import { recordPayment, periodKeyFromDate } from "@/lib/ledger";
import { applyPaymentToRecovery } from "@/lib/recovery/service";

export type ScheduledExecuteResult =
  | {
      ok: true;
      paymentId: string;
      method: "card" | "ach";
      amount: number;
    }
  | {
      ok: false;
      retry: boolean;
      reason: string;
      code:
        | "NO_METHOD_ON_FILE"
        | "PROPERTY_NOT_APPROVED"
        | "MERCHANT_NOT_APPROVED"
        | "GATEWAY_DECLINED"
        | "GATEWAY_ERROR"
        | "TENANT_NOT_FOUND"
        | "ROW_NOT_FOUND";
    };

// ─── Helper: best-effort accounting + recovery hooks ───
// Same pattern as /api/payments/charge — fire-and-forget, never let
// these block the executor's success path. Errors log loudly.
async function tryJournalPayment(paymentId: string, pmId: string) {
  try {
    const { seedDefaultAccounts } = await import(
      "@/lib/accounting/chart-of-accounts"
    );
    await seedDefaultAccounts(pmId);
    const { journalIncomingPayment } = await import(
      "@/lib/accounting/auto-entries"
    );
    await journalIncomingPayment(paymentId);
  } catch (err) {
    console.error("[scheduled] journalIncomingPayment failed:", err);
  }
}

async function tryApplyToRecovery(paymentId: string) {
  try {
    await applyPaymentToRecovery(paymentId);
  } catch (err) {
    console.error("[scheduled] applyPaymentToRecovery failed:", err);
  }
}

export async function executeScheduledPayment(
  scheduledPaymentId: string
): Promise<ScheduledExecuteResult> {
  // Load the scheduled row + everything we need for the charge in one
  // hit. Belt-and-suspenders: re-check executed=false because cron
  // overlap guard could theoretically fire twice if the schedule
  // changes (it won't with current vercel config, but cheap insurance).
  const sp = await db.scheduledPayment.findFirst({
    where: { id: scheduledPaymentId, executed: false },
    include: {
      tenant: {
        include: {
          unit: {
            include: {
              property: {
                select: { kadimaTerminalId: true },
              },
            },
          },
        },
      },
    },
  });

  if (!sp) {
    return {
      ok: false,
      retry: false,
      reason: "Scheduled payment not found or already executed",
      code: "ROW_NOT_FOUND",
    };
  }

  if (!sp.tenant) {
    return {
      ok: false,
      retry: false,
      reason: "Tenant profile no longer exists",
      code: "TENANT_NOT_FOUND",
    };
  }

  const tenant = sp.tenant;
  const amount = Number(sp.amount);
  const description =
    sp.description || `Scheduled ${sp.type.toLowerCase()} payment`;

  // ─── Method selection (auto-pick at execution time) ───
  // ACH first (cheaper), card fallback. If neither is on file we
  // bail out as retry-able — tenant may add a method tomorrow.
  let method: "card" | "ach";
  if (tenant.kadimaCustomerId && tenant.kadimaAccountId) {
    method = "ach";
  } else if (tenant.kadimaCustomerId && tenant.kadimaCardTokenId) {
    method = "card";
  } else {
    return {
      ok: false,
      retry: true,
      reason:
        "Tenant has no card or bank account on file. Will retry next run.",
      code: "NO_METHOD_ON_FILE",
    };
  }

  // ─── Underwriter gate (hard fail, no retry) ───
  // If the property hasn't cleared underwriting we can't process
  // money for it regardless of how many times we try. Surface it
  // immediately so the PM knows to either get the property approved
  // or cancel the scheduled payment.
  const propertyGuard = await assertUnitPropertyApproved(sp.unitId);
  if (!propertyGuard.ok) {
    return {
      ok: false,
      retry: false,
      reason: propertyGuard.reason || "Property not approved for payments",
      code: "PROPERTY_NOT_APPROVED",
    };
  }

  // ─── Merchant approval gate (hard fail, no retry) ───
  const approvalCheck = await checkMerchantApproval(sp.landlordId);
  if (!approvalCheck.approved) {
    return {
      ok: false,
      retry: false,
      reason:
        approvalCheck.reason || "Merchant account not approved for payments",
      code: "MERCHANT_NOT_APPROVED",
    };
  }

  // ─── Create Payment row in PENDING; gateway result fills it in ───
  // source="scheduled" matches the chargeSchema source enum so the
  // payment shows up as scheduled-origin in the audit / payments list.
  const payment = await db.payment.create({
    data: {
      tenantId: sp.tenantId,
      unitId: sp.unitId,
      landlordId: sp.landlordId,
      amount: new Decimal(amount.toString()),
      type: sp.type,
      status: "PENDING",
      paymentMethod: method,
      dueDate: sp.scheduledDate,
      description,
      source: "scheduled",
    },
  });

  const merchantCreds = await getMerchantCredentials(sp.landlordId);
  const terminalIdOverride =
    tenant.unit?.property?.kadimaTerminalId || undefined;

  // ─── Card path ───
  if (method === "card") {
    try {
      const result = await merchantCreateSaleFromVault(merchantCreds, {
        cardToken: tenant.kadimaCardTokenId!,
        amount,
        terminalIdOverride,
      });

      const approved = result.status?.status === "Approved";
      const cardLast4 = result.card?.number
        ? String(result.card.number)
        : undefined;

      await db.payment.update({
        where: { id: payment.id },
        data: {
          status: approved ? "COMPLETED" : "FAILED",
          kadimaTransactionId: String(result.id),
          kadimaStatus: result.status?.status || null,
          paidAt: approved ? new Date() : null,
          processedAt: new Date(),
          ...(!approved && {
            failedReason: `Gateway declined: ${result.status?.status || "unknown"}`,
          }),
          ...(cardLast4 && { cardLast4 }),
        },
      });

      if (!approved) {
        return {
          ok: false,
          retry: true,
          reason: `Card declined: ${result.status?.status || "unknown"}`,
          code: "GATEWAY_DECLINED",
        };
      }

      // ─── Success path: ledger + accounting + recovery ───
      // Mirror the charge route's hooks. recordPayment is awaited so
      // the response can include final balance; the others are best
      // effort.
      await recordPayment({
        tenantId: sp.tenantId,
        unitId: sp.unitId,
        paymentId: payment.id,
        amount,
        periodKey: periodKeyFromDate(sp.scheduledDate),
        description: `Scheduled charge — ${description}`,
      }).catch((e) =>
        console.error("[scheduled] recordPayment failed:", e)
      );

      await tryJournalPayment(payment.id, sp.landlordId);
      if (sp.type === "RENT") {
        await tryApplyToRecovery(payment.id);
      }

      return { ok: true, paymentId: payment.id, method: "card", amount };
    } catch (chargeErr) {
      const errMsg =
        chargeErr instanceof Error
          ? chargeErr.message
          : "Payment gateway error";
      await db.payment.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          kadimaStatus: "gateway_error",
          failedReason: errMsg,
          processedAt: new Date(),
        },
      });
      return {
        ok: false,
        retry: true,
        reason: errMsg,
        code: "GATEWAY_ERROR",
      };
    }
  }

  // ─── ACH path ───
  // SEC=PPD ("pm_back_office_standing") matches the discipline used by
  // the charge route + autopay engine for PM-initiated standing
  // authorizations against vaulted bank accounts.
  try {
    const secCode = pickSecCode({ kind: "pm_back_office_standing" });
    const achResult = (await merchantCreateAchDebit(merchantCreds, {
      customerId: tenant.kadimaCustomerId!,
      accountId: tenant.kadimaAccountId!,
      amount,
      secCode,
      memo: `Scheduled charge — ${description}`,
    })) as {
      id?: string | number;
      status?: { status?: string } | string;
    };

    const rawStatus =
      typeof achResult.status === "string"
        ? achResult.status
        : achResult.status?.status;
    const approved = rawStatus === "Approved";

    await db.payment.update({
      where: { id: payment.id },
      data: {
        status: approved ? "COMPLETED" : "FAILED",
        kadimaTransactionId:
          achResult.id != null ? String(achResult.id) : null,
        kadimaStatus: rawStatus || null,
        paidAt: approved ? new Date() : null,
        processedAt: new Date(),
        achSecCode: secCode,
        achLast4: tenant.bankLast4 ?? undefined,
        ...(!approved && {
          failedReason: `Gateway declined: ${rawStatus || "unknown"}`,
        }),
      },
    });

    if (!approved) {
      return {
        ok: false,
        retry: true,
        reason: `ACH declined: ${rawStatus || "unknown"}`,
        code: "GATEWAY_DECLINED",
      };
    }

    await recordPayment({
      tenantId: sp.tenantId,
      unitId: sp.unitId,
      paymentId: payment.id,
      amount,
      periodKey: periodKeyFromDate(sp.scheduledDate),
      description: `Scheduled ACH charge — ${description}`,
    }).catch((e) =>
      console.error("[scheduled] recordPayment failed:", e)
    );

    await tryJournalPayment(payment.id, sp.landlordId);
    if (sp.type === "RENT") {
      await tryApplyToRecovery(payment.id);
    }

    return { ok: true, paymentId: payment.id, method: "ach", amount };
  } catch (chargeErr) {
    const errMsg =
      chargeErr instanceof Error ? chargeErr.message : "ACH gateway error";
    await db.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        kadimaStatus: "gateway_error",
        failedReason: errMsg,
        processedAt: new Date(),
      },
    });
    return {
      ok: false,
      retry: true,
      reason: errMsg,
      code: "GATEWAY_ERROR",
    };
  }
}

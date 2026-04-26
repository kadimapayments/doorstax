import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { resolveApiLandlord } from "@/lib/api-landlord";
import { getMerchantCredentials } from "@/lib/kadima/merchant-context";
import { merchantCreateSaleFromVault } from "@/lib/kadima/merchant-gateway";
import { merchantCreateAchDebit } from "@/lib/kadima/merchant-ach";
import { checkMerchantApproval } from "@/lib/kadima/merchant-guard";
import { assertUnitPropertyApproved } from "@/lib/property-guard";
import { pickSecCode } from "@/lib/kadima/sec-code";
import { recordPayment, periodKeyFromDate } from "@/lib/ledger";
import {
  recordOfflinePayment,
  OfflinePaymentError,
} from "@/lib/offline-payments/record";
import { paymentLimiter, rateLimitResponse } from "@/lib/rate-limit";

/**
 * POST /api/payments/charge
 *
 * PM-initiated charge with method picker support.
 *
 * The bug Walter Parker exposed: previously this route hard-coded
 * `paymentMethod: "card"` and silently created a PENDING Payment row
 * when the tenant had no card on file (no Kadima call, no error).
 * That left ghost rows on the books and the PM thinking they'd
 * charged a tenant who in fact had no payment method.
 *
 * Fix: method picker + hard blocks BEFORE Payment.create. If the
 * chosen method can't possibly succeed (no card on file, no bank on
 * file, owner doesn't accept cash, etc.) we reject with 400 + a
 * specific error code so the UI can say something useful. No more
 * ghost rows.
 *
 * Preserves the existing safeguards from the prior implementation:
 *   - resolveApiLandlord (admin "View as PM" support)
 *   - assertUnitPropertyApproved (underwriter gate — properties not
 *     yet cleared by underwriting can't process live money)
 *   - checkMerchantApproval (PM's merchant must be approved)
 *   - merchantCreateSaleFromVault (PM-merchant credentials, NOT
 *     platform DBA — every other payment route in the codebase uses
 *     this pattern)
 *   - vault card verification (catches deleted-card-on-file before
 *     the gateway call)
 *
 * Adds:
 *   - paymentMethod in request body ("card" | "ach" | "cash" | "check")
 *   - hard blocks on missing payment data per method
 *   - PM-side ACH path (merchantCreateAchDebit + SEC=PPD)
 *   - cash / check delegation to recordOfflinePayment service
 */

const chargeSchema = z.object({
  tenantId: z.string().min(1, "Tenant is required"),
  unitId: z.string().min(1, "Unit is required"),
  amount: z.coerce.number().min(0.01, "Amount must be at least $0.01"),
  type: z.enum(["RENT", "DEPOSIT", "FEE"]).default("RENT"),
  description: z.string().optional(),
  source: z
    .enum(["tenant-portal", "virtual-terminal", "autopay", "scheduled"])
    .optional(),
  // ─── Method picker (new) ───
  paymentMethod: z
    .enum(["card", "ach", "cash", "check"])
    .default("card"),
  // ─── Cash / check optional fields ───
  checkNumber: z.string().max(30).optional(),
  checkDate: z.string().optional(),
  payerBankName: z.string().max(120).optional(),
  memoLine: z.string().max(200).optional(),
  checkSubType: z
    .enum(["PERSONAL", "MONEY_ORDER", "CASHIERS_CHECK"])
    .optional(),
  dateReceived: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

export async function POST(req: Request) {
  const ctx = await resolveApiLandlord();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate-limit by the actor (admin if impersonating, PM otherwise) —
  // matches every other charge / payment route in the codebase.
  const rl = await paymentLimiter.limit(ctx.actorId);
  if (!rl.success) return rateLimitResponse(rl.reset);

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const data = chargeSchema.parse(body);

    // Verify landlord owns this unit + tenant assignment + grab owner
    // config (acceptsCash / acceptsChecks) and Kadima terminal id in
    // the same query.
    const tenant = await db.tenantProfile.findFirst({
      where: {
        id: data.tenantId,
        unitId: data.unitId,
        unit: { property: { landlordId: ctx.landlordId } },
      },
      include: {
        unit: {
          include: {
            property: {
              select: {
                kadimaTerminalId: true,
                owner: {
                  select: { acceptsCash: true, acceptsChecks: true },
                },
              },
            },
          },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant or unit not found" },
        { status: 404 }
      );
    }

    // ─── Underwriter gate: property must be APPROVED ───
    // Live / legacy properties default to APPROVED; only properties
    // that went through the new boarding wizard start PENDING_REVIEW.
    // Applies to every method including cash/check — if the property
    // isn't cleared, no money moves at all.
    const propertyGuard = await assertUnitPropertyApproved(data.unitId);
    if (!propertyGuard.ok) {
      return NextResponse.json(
        { error: propertyGuard.reason },
        { status: 403 }
      );
    }

    // ─── Method-specific hard blocks ───
    // Reject before creating any Payment row if the method can't
    // possibly succeed. Replaces the old "create row, then maybe
    // try Kadima, then maybe leave PENDING" path that silently
    // dropped ghost rows when a tenant had no vault on file.
    if (data.paymentMethod === "card") {
      if (!tenant.kadimaCustomerId || !tenant.kadimaCardTokenId) {
        return NextResponse.json(
          {
            error:
              "Tenant has no card on file. Choose a different method or have them add one in their portal.",
            code: "NO_CARD_ON_FILE",
          },
          { status: 400 }
        );
      }
    }

    if (data.paymentMethod === "ach") {
      if (!tenant.kadimaCustomerId || !tenant.kadimaAccountId) {
        return NextResponse.json(
          {
            error:
              "Tenant has no bank account on file. Choose a different method or have them add one in their portal.",
            code: "NO_ACH_ON_FILE",
          },
          { status: 400 }
        );
      }
    }

    if (data.paymentMethod === "cash") {
      if (!tenant.unit?.property?.owner?.acceptsCash) {
        return NextResponse.json(
          {
            error:
              "Cash payments are not enabled for this property. Enable on the owner page first.",
            code: "CASH_NOT_ACCEPTED",
          },
          { status: 400 }
        );
      }
    }

    if (data.paymentMethod === "check") {
      if (!tenant.unit?.property?.owner?.acceptsChecks) {
        return NextResponse.json(
          {
            error:
              "Check payments are not enabled for this property. Enable on the owner page first.",
            code: "CHECK_NOT_ACCEPTED",
          },
          { status: 400 }
        );
      }
      if (!data.checkNumber?.trim()) {
        return NextResponse.json(
          { error: "Check number is required.", code: "MISSING_CHECK_NUMBER" },
          { status: 400 }
        );
      }
    }

    // ─── Cash / check: delegate to offline payments service ───
    // The service runs its own atomic transaction (reserve receipt
    // number → create Payment → write ledger entry), so we just
    // adapt the request fields to its signature and translate
    // OfflinePaymentError back to HTTP. The bonus check fields
    // (payerBankName, memoLine, checkSubType, checkDate) get folded
    // into the notes payload until the service grows columns for
    // them in a future drop.
    if (data.paymentMethod === "cash" || data.paymentMethod === "check") {
      // Fold the extra check metadata into the notes line so it's
      // preserved on the Payment.notes field for audit. Once the
      // offline-payments service grows dedicated columns we can
      // pass these through structurally instead.
      const extras: string[] = [];
      if (data.paymentMethod === "check") {
        if (data.checkSubType) extras.push(`Type: ${data.checkSubType}`);
        if (data.checkDate) extras.push(`Check date: ${data.checkDate}`);
        if (data.payerBankName?.trim())
          extras.push(`Bank: ${data.payerBankName.trim()}`);
        if (data.memoLine?.trim())
          extras.push(`Memo: ${data.memoLine.trim()}`);
      }
      const composedNotes = [
        data.notes ?? data.description,
        extras.length > 0 ? extras.join(" · ") : null,
      ]
        .filter(Boolean)
        .join(" — ");

      try {
        const result = await recordOfflinePayment({
          tenantId: data.tenantId,
          landlordId: ctx.landlordId,
          actorId: ctx.actorId,
          amount: data.amount,
          method: data.paymentMethod,
          dateReceived: data.dateReceived
            ? new Date(data.dateReceived)
            : new Date(),
          notes: composedNotes || undefined,
          checkNumber:
            data.paymentMethod === "check" ? data.checkNumber : undefined,
        });

        return NextResponse.json(
          {
            success: true,
            paymentId: result.paymentId,
            receiptNumber: result.receiptNumber,
            charged: true,
            method: data.paymentMethod,
          },
          { status: 201 }
        );
      } catch (err) {
        if (err instanceof OfflinePaymentError) {
          return NextResponse.json(
            { error: err.message, code: err.code },
            { status: err.status }
          );
        }
        throw err;
      }
    }

    // ─── Kadima methods (card / ACH) ───
    // Verify PM's merchant application is approved before any gateway
    // call. Cash/check skip this — they're not gated on Kadima at all.
    const approvalCheck = await checkMerchantApproval(ctx.landlordId);
    if (!approvalCheck.approved) {
      return NextResponse.json(
        {
          error:
            approvalCheck.reason ||
            "Merchant account not approved for payments",
        },
        { status: 403 }
      );
    }

    // Create the Payment row in PENDING; we'll update it with the
    // gateway result.
    const payment = await db.payment.create({
      data: {
        tenantId: data.tenantId,
        unitId: data.unitId,
        landlordId: ctx.landlordId,
        amount: data.amount,
        type: data.type,
        status: "PENDING",
        paymentMethod: data.paymentMethod,
        dueDate: new Date(),
        description: data.description,
        source: data.source || null,
      },
    });

    const merchantCreds = await getMerchantCredentials(ctx.landlordId);
    const terminalIdOverride =
      tenant.unit?.property?.kadimaTerminalId || undefined;

    // ─── Card path ───
    if (data.paymentMethod === "card") {
      try {
        // Vault card verification — make sure the saved card token
        // still exists on the Kadima vault before we try to charge it.
        // Catches "tenant deleted their card from the portal" cases
        // before they hit the gateway as a generic decline.
        try {
          const { listCards } = await import("@/lib/kadima/customer-vault");
          const vaultCards = await listCards(tenant.kadimaCustomerId!);
          const cardExists = vaultCards.items?.some(
            (c: { id?: number | string; token?: string }) =>
              String(c.id) === tenant.kadimaCardTokenId ||
              String(c.token) === tenant.kadimaCardTokenId
          );
          if (!cardExists) {
            await db.payment.update({
              where: { id: payment.id },
              data: {
                status: "FAILED",
                failedReason: "Vault card no longer exists",
                processedAt: new Date(),
              },
            });
            return NextResponse.json(
              {
                success: false,
                paymentId: payment.id,
                charged: false,
                error: "Tenant's saved card is no longer available",
                code: "VAULT_CARD_MISSING",
              },
              { status: 400 }
            );
          }
        } catch (vaultErr) {
          // Vault verification is best-effort — proceed with the
          // charge attempt and let the gateway decide.
          console.error(
            "[charge] Vault card verification failed:",
            vaultErr
          );
        }

        const result = await merchantCreateSaleFromVault(merchantCreds, {
          cardToken: tenant.kadimaCardTokenId!,
          amount: data.amount,
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

        if (approved) {
          recordPayment({
            tenantId: data.tenantId,
            unitId: data.unitId,
            paymentId: payment.id,
            amount: data.amount,
            periodKey: periodKeyFromDate(new Date()),
            description: `PM charge — ${data.description || data.type}`,
          }).catch((e) =>
            console.error("[ledger] PM charge entry failed:", e)
          );
        }

        return NextResponse.json(
          {
            success: true,
            paymentId: payment.id,
            charged: approved,
            method: "card",
            ...(approved
              ? {}
              : { error: `Payment declined: ${result.status?.status || "unknown"}` }),
          },
          { status: 201 }
        );
      } catch (chargeErr: unknown) {
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

        return NextResponse.json(
          {
            success: false,
            paymentId: payment.id,
            charged: false,
            error: "Payment gateway error — payment recorded as failed",
            code: "GATEWAY_ERROR",
          },
          { status: 502 }
        );
      }
    }

    // ─── ACH path (PM-initiated, merchant credentials) ───
    // PM-initiated back-office charge against a tenant's vaulted bank
    // account. NACHA SEC code "PPD" — assumes the tenant signed a
    // standing electronic authorisation when they vaulted the account
    // (the tenant onboarding flow captures this). Mirrors the SEC-code
    // discipline established for autopay and the offline-payments
    // engine.
    try {
      const secCode = pickSecCode({ kind: "pm_back_office_standing" });
      const result = (await merchantCreateAchDebit(merchantCreds, {
        customerId: tenant.kadimaCustomerId!,
        accountId: tenant.kadimaAccountId!,
        amount: data.amount,
        secCode,
        memo: `PM charge — ${data.description || data.type}`,
      })) as {
        id?: string | number;
        status?: { status?: string } | string;
      };

      const rawStatus =
        typeof result.status === "string"
          ? result.status
          : result.status?.status;
      const approved = rawStatus === "Approved";

      await db.payment.update({
        where: { id: payment.id },
        data: {
          status: approved ? "COMPLETED" : "FAILED",
          kadimaTransactionId: result.id != null ? String(result.id) : null,
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

      if (approved) {
        recordPayment({
          tenantId: data.tenantId,
          unitId: data.unitId,
          paymentId: payment.id,
          amount: data.amount,
          periodKey: periodKeyFromDate(new Date()),
          description: `PM ACH charge — ${data.description || data.type}`,
        }).catch((e) =>
          console.error("[ledger] PM ACH charge entry failed:", e)
        );
      }

      return NextResponse.json(
        {
          success: true,
          paymentId: payment.id,
          charged: approved,
          method: "ach",
          ...(approved
            ? {}
            : { error: `ACH declined: ${rawStatus || "unknown"}` }),
        },
        { status: 201 }
      );
    } catch (chargeErr: unknown) {
      const errMsg =
        chargeErr instanceof Error
          ? chargeErr.message
          : "ACH gateway error";
      await db.payment.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          kadimaStatus: "gateway_error",
          failedReason: errMsg,
          processedAt: new Date(),
        },
      });

      return NextResponse.json(
        {
          success: false,
          paymentId: payment.id,
          charged: false,
          error: "ACH gateway error — payment recorded as failed",
          code: "GATEWAY_ERROR",
        },
        { status: 502 }
      );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error("[charge] unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

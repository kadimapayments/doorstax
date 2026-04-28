export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as achService from "@/lib/kadima/ach";
import * as gatewayService from "@/lib/kadima/gateway";
import { getMerchantCredentialsForTenant } from "@/lib/kadima/merchant-context";
import { merchantCreateSaleFromVault } from "@/lib/kadima/merchant-gateway";
import { checkMerchantApprovalForTenant } from "@/lib/kadima/merchant-guard";
import { pickSecCode, type AchSecCode } from "@/lib/kadima/sec-code";

import { getEffectiveLandlordId } from "@/lib/team-context";
import { z } from "zod";
import { paymentLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { emit } from "@/lib/events/emitter";

const createPaymentSchema = z.object({
  unitId: z.string(),
  amount: z.number().positive(),
  paymentMethod: z.enum(["ach", "card"]),
  // ACH fields
  routingNumber: z.string().optional(),
  accountNumber: z.string().optional(),
  accountType: z.enum(["checking", "savings"]).optional(),
  // Card fields (used with vault)
  cardId: z.string().optional(),
  // Vault-based
  useVault: z.boolean().default(false),
  // ACH authorization
  achAuthorized: z.boolean().optional(),
  // Idempotency — client must send a unique key per payment attempt
  idempotencyKey: z.string().min(10).max(128).optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const perPage = 20;
  const statusParam = searchParams.get("status") || undefined;
  const typeParam = searchParams.get("type") || undefined;
  const fromParam = searchParams.get("from") || undefined;
  const toParam = searchParams.get("to") || undefined;
  const tenantIdParam = searchParams.get("tenantId") || undefined;
  const searchParam = searchParams.get("search")?.trim() || undefined;
  const limitParam = searchParams.get("limit")
    ? parseInt(searchParams.get("limit")!, 10)
    : undefined;
  const allowedSortFields = ["createdAt", "amount", "status", "paymentMethod", "dueDate"];
  const rawSort = searchParams.get("sort") || "createdAt";
  const sortParam = allowedSortFields.includes(rawSort) ? rawSort : "createdAt";
  const dirParam = searchParams.get("dir") === "asc" ? "asc" : "desc";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (session.user.role === "TENANT") {
    const profile = await db.tenantProfile.findUnique({
      where: { userId: session.user.id },
    });
    if (!profile) {
      return NextResponse.json({ error: "No tenant profile" }, { status: 404 });
    }
    where.tenantId = profile.id;
  } else if (session.user.role === "PM") {
    where.landlordId = await getEffectiveLandlordId(session.user.id);
  }

  // Allow PM to filter by tenant (used by Statement Builder)
  if (tenantIdParam && session.user.role === "PM") {
    where.tenantId = tenantIdParam;
  }

  if (statusParam) where.status = statusParam;
  if (typeParam) where.type = typeParam;
  if (fromParam || toParam) {
    where.dueDate = {};
    if (fromParam) where.dueDate.gte = new Date(fromParam);
    if (toParam) where.dueDate.lte = new Date(toParam + "T23:59:59.999Z");
  }

  // Full-text search across tenant name, property name, and unit number
  if (searchParam) {
    where.OR = [
      { unit: { property: { name: { contains: searchParam, mode: "insensitive" } } } },
      { unit: { unitNumber: { contains: searchParam, mode: "insensitive" } } },
      { tenant: { user: { name: { contains: searchParam, mode: "insensitive" } } } },
    ];
  }

  const orderBy = { [sortParam]: dirParam };

  const [payments, total] = await Promise.all([
    db.payment.findMany({
      where,
      include: {
        unit: { select: { unitNumber: true, property: { select: { name: true } } } },
        tenant: { select: { user: { select: { name: true } } } },
      },
      orderBy,
      skip: limitParam ? 0 : (page - 1) * perPage,
      take: limitParam || perPage,
    }),
    db.payment.count({ where }),
  ]);

  return NextResponse.json({
    payments,
    meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "TENANT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ─── Rate Limiting (by userId) ──────────────────────────────
  const rl = await paymentLimiter.limit(session.user.id);
  if (!rl.success) return rateLimitResponse(rl.reset);

  try {
    const body = await req.json();
    const data = createPaymentSchema.parse(body);

    // ─── Idempotency Check ───────────────────────────────────
    // If client sends an idempotency key, check for existing payment
    if (data.idempotencyKey) {
      const existingPayment = await db.payment.findUnique({
        where: { idempotencyKey: data.idempotencyKey },
        select: { id: true, status: true, amount: true, surchargeAmount: true, landlordFee: true },
      });
      if (existingPayment) {
        // Return the existing payment — don't double-charge
        console.log("[payments] Idempotency hit:", data.idempotencyKey, existingPayment.id);
        return NextResponse.json(
          {
            ...existingPayment,
            totalCharged: Number(existingPayment.amount) + Number(existingPayment.surchargeAmount || 0),
            idempotent: true,
          },
          { status: 200 }
        );
      }
    }

    const profile = await db.tenantProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        unit: {
          include: { property: { select: { landlordId: true, kadimaTerminalId: true } } },
        },
      },
    });

    if (!profile || !profile.unit) {
      return NextResponse.json(
        { error: "No unit assigned" },
        { status: 400 }
      );
    }

    // ─── Concurrent Payment Prevention ───────────────────────
    // Block if there's already a PENDING payment for the same tenant+unit
    const pendingPayment = await db.payment.findFirst({
      where: {
        tenantId: profile.id,
        unitId: profile.unit.id,
        status: "PENDING",
        // Only block if it was created in the last 10 minutes (stale protection)
        createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
      },
      select: { id: true, createdAt: true },
    });
    if (pendingPayment) {
      console.warn("[payments] Concurrent payment blocked:", {
        tenantId: profile.id,
        unitId: profile.unit.id,
        existingPaymentId: pendingPayment.id,
      });
      return NextResponse.json(
        {
          error: "A payment is already being processed. Please wait a moment and try again.",
          existingPaymentId: pendingPayment.id,
        },
        { status: 409 }
      );
    }

    // Calculate fees based on payment method
    const baseAmount = data.amount;
    let surchargeAmount = 0;
    let landlordFee = 0;
    let chargeAmount = baseAmount;

    if (data.paymentMethod === "card") {
      // Card: tenant pays +3.25% surcharge
      surchargeAmount = Math.round(baseAmount * 0.0325 * 100) / 100;
      chargeAmount = baseAmount + surchargeAmount;
    } else {
      // ACH: resolve fees — Property fee schedule > Owner fee schedule > Owner direct > defaults
      const propertyWithFees = await db.property.findFirst({
        where: { id: profile.unit.propertyId },
        include: {
          feeSchedule: { select: { achRate: true, achFeeResponsibility: true } },
          owner: {
            select: {
              achRate: true,
              achFeeResponsibility: true,
              feeSchedule: {
                select: { achRate: true, achFeeResponsibility: true },
              },
            },
          },
        },
      });

      const propSchedule = propertyWithFees?.feeSchedule;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ownerSchedule = (propertyWithFees?.owner as any)?.feeSchedule;
      const ownerDirect = propertyWithFees?.owner;

      const achFeeMode: string =
        propSchedule?.achFeeResponsibility ??
        ownerSchedule?.achFeeResponsibility ??
        (ownerDirect as any)?.achFeeResponsibility ??
        "OWNER";

      const achRate: number = Number(
        propSchedule?.achRate ??
        ownerSchedule?.achRate ??
        (ownerDirect as any)?.achRate ??
        6
      );

      if (achFeeMode === "TENANT") {
        // Tenant pays ACH fee as a surcharge (capped at $6)
        surchargeAmount = Math.min(achRate, 6);
        chargeAmount = baseAmount + surchargeAmount;
        landlordFee = 0;
      } else if (achFeeMode === "PM") {
        // PM absorbs — tenant and owner unaffected
        chargeAmount = baseAmount;
        landlordFee = 0;
      } else {
        // OWNER (default) — deducted from owner payout
        chargeAmount = baseAmount;
        landlordFee = achRate;
      }
    }

    // Verify the PM's merchant application is approved for this tenant's property
    const approvalCheck = await checkMerchantApprovalForTenant(profile.id);
    if (!approvalCheck.approved) {
      return NextResponse.json(
        { error: approvalCheck.reason || "Payment processing is not yet enabled for this property" },
        { status: 403 }
      );
    }

    // ─── Vault Card Verification ─────────────────────────────
    // If paying by card from vault, verify the card token actually exists
    if (data.paymentMethod === "card" && data.useVault && data.cardId && profile.kadimaCustomerId) {
      try {
        const { listCards } = await import("@/lib/kadima/customer-vault");
        const vaultCards = await listCards(profile.kadimaCustomerId);
        const cardExists = vaultCards.items?.some(
          (c: { id?: number | string; token?: string }) =>
            String(c.id) === data.cardId || String(c.token) === data.cardId
        );
        if (!cardExists) {
          return NextResponse.json(
            { error: "The selected card is no longer available. Please add a new card and try again." },
            { status: 400 }
          );
        }
      } catch (vaultErr) {
        console.error("[payments] Vault card verification failed:", vaultErr);
        // Non-blocking — proceed with charge attempt (gateway will reject if invalid)
      }
    }

    // ─── ACH Vault Verification ──────────────────────────────
    if (data.paymentMethod === "ach" && data.useVault && profile.kadimaCustomerId) {
      if (!profile.kadimaAccountId) {
        return NextResponse.json(
          { error: "No bank account on file. Please add a bank account and try again." },
          { status: 400 }
        );
      }
    }

    // ─── PENDING-first: Create payment record BEFORE gateway call ───
    const payment = await db.payment.create({
      data: {
        tenantId: profile.id,
        unitId: profile.unit.id,
        landlordId: profile.unit.property.landlordId,
        amount: baseAmount,
        type: "RENT",
        status: "PENDING",
        paymentMethod: data.paymentMethod,
        dueDate: new Date(),
        surchargeAmount: surchargeAmount > 0 ? surchargeAmount : null,
        landlordFee: landlordFee > 0 ? landlordFee : null,
        idempotencyKey: data.idempotencyKey || null,
        ...(data.paymentMethod === "ach" && data.achAuthorized
          ? { achAuthorizedAt: new Date() }
          : {}),
      },
    });

    let kadimaResult;
    // Track which SEC code we sent so it lands on the Payment row
    // for audit / dispute defence. Stays null for card payments.
    let achSecCodeUsed: AchSecCode | null = null;

    // Determine terminal ID for card payments
    const cardTerminalId = profile.unit.property.kadimaTerminalId || undefined;

    try {
      if (data.paymentMethod === "ach") {
        if (data.useVault && profile.kadimaCustomerId && profile.kadimaAccountId) {
          // Tenant clicked Pay through the web portal against a
          // previously-vaulted account. The transaction itself is
          // browser-initiated → WEB.
          achSecCodeUsed = pickSecCode({ kind: "tenant_web_vault" });
          kadimaResult = await achService.createAchFromVault({
            customerId: profile.kadimaCustomerId,
            accountId: profile.kadimaAccountId,
            amount: chargeAmount,
            secCode: achSecCodeUsed,
            memo: `Rent payment - ${profile.unit.unitNumber}`,
          });
        } else if (data.routingNumber && data.accountNumber && data.accountType) {
          // Tenant typed ACH details into the portal form for a
          // one-off rent payment → WEB.
          achSecCodeUsed = pickSecCode({ kind: "tenant_web_inline" });
          kadimaResult = await achService.createAchTransaction({
            amount: chargeAmount,
            firstName: session.user.name?.split(" ")[0] || "",
            lastName: session.user.name?.split(" ").slice(1).join(" ") || "",
            routingNumber: data.routingNumber,
            accountNumber: data.accountNumber,
            accountType: data.accountType,
            secCode: achSecCodeUsed,
            memo: `Rent payment - ${profile.unit.unitNumber}`,
          });
        }
      } else if (data.paymentMethod === "card") {
        if (data.useVault && profile.kadimaCustomerId && data.cardId) {
          const merchantCreds = await getMerchantCredentialsForTenant(profile.id);
          kadimaResult = await merchantCreateSaleFromVault(merchantCreds, {
            cardToken: data.cardId,
            amount: chargeAmount,
            terminalIdOverride: cardTerminalId,
          });
        }
      }
    } catch (kadimaErr: any) {
      // Kadima call failed — mark payment as FAILED with detailed reason
      const failedReason = kadimaErr?.response?.data?.message || kadimaErr?.message || "Payment gateway error";
      console.error("[payments] Kadima charge failed:", {
        message: kadimaErr?.message,
        status: kadimaErr?.response?.status,
        data: JSON.stringify(kadimaErr?.response?.data),
        paymentId: payment.id,
        method: data.paymentMethod,
      });
      await db.payment.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          kadimaStatus: "gateway_error",
          declineReasonCode: failedReason,
          failedReason,
          processedAt: new Date(),
        },
      });
      return NextResponse.json(
        { error: "Payment failed", paymentId: payment.id },
        { status: 502 }
      );
    }

    // Update payment with Kadima transaction details
    if (kadimaResult) {
      // Gateway responses are direct objects, not wrapped in .data
      // Method-specific status interpretation:
      //
      //  • Card: Kadima returns synchronous approval. status nested
      //    at result.status.status — must be "approved" / "settled" /
      //    "completed" for COMPLETED, otherwise FAILED (declined).
      //
      //  • ACH: Kadima accepts submission and returns the txn id;
      //    actual settlement happens 1–3 business days later. There's
      //    no "Approved" status synchronously. If we got here without
      //    throwing, the submission was accepted → PROCESSING. The
      //    reconciliation cron polls Kadima for settle status and
      //    promotes PROCESSING → COMPLETED, or → FAILED + REVERSAL on
      //    bounce. Synchronous gateway errors throw and are caught
      //    above (already mark FAILED).
      const isCard = data.paymentMethod === "card";
      const kadimaStatus = isCard
        ? (kadimaResult as any).status?.status
        : (kadimaResult as any).status;
      const cardApproved =
        isCard &&
        typeof kadimaStatus === "string" &&
        ["approved", "settled", "completed"].includes(kadimaStatus.toLowerCase());

      const cardLast4 = isCard && (kadimaResult as any).card?.number
        ? String((kadimaResult as any).card.number)
        : undefined;
      const achLast4 = !isCard && (kadimaResult as any).accountNumber
        ? String((kadimaResult as any).accountNumber).slice(-4)
        : undefined;

      const finalStatus = isCard
        ? (cardApproved ? "COMPLETED" : "FAILED")
        : "PROCESSING";
      const finalPaidAt = isCard && cardApproved ? new Date() : null;

      await db.payment.update({
        where: { id: payment.id },
        data: {
          status: finalStatus,
          paidAt: finalPaidAt,
          processedAt: new Date(),
          kadimaTransactionId: String((kadimaResult as any).id ?? ""),
          kadimaStatus:
            typeof kadimaStatus === "string"
              ? kadimaStatus
              : !isCard
                ? "Submitted"
                : null,
          ...(isCard && !cardApproved && {
            failedReason: `Gateway declined: ${kadimaStatus || "unknown"}`,
          }),
          ...(cardLast4 && { cardLast4 }),
          ...(achLast4 && { achLast4 }),
          ...(achSecCodeUsed && { achSecCode: achSecCodeUsed }),
        },
      });
    }

    // ── Accounting: auto-create journal entry ──
    // Uses the unified `journalIncomingPayment` helper, which picks
    // the right credit account based on payment.type (4000 Rent,
    // 4100 Late Fee, 4200 Application, etc.). Idempotent — dedup
    // guard keys on (pmId, source, sourceId).
    //
    // Fires for COMPLETED (card cleared) and PROCESSING (ACH
    // submitted). Why journal at submit time for ACH instead of
    // waiting for settle: it makes the books symmetric with the
    // tenant ledger, which writes the PAYMENT entry at submit.
    // Bounces are handled via journalReversal in the reconciliation
    // cron, mirroring the REVERSAL ledger entry.
    try {
      const freshPayment = await db.payment.findUnique({
        where: { id: payment.id },
        select: { status: true },
      });
      if (
        freshPayment?.status === "COMPLETED" ||
        freshPayment?.status === "PROCESSING"
      ) {
        const { seedDefaultAccounts } = await import(
          "@/lib/accounting/chart-of-accounts"
        );
        await seedDefaultAccounts(profile.unit.property.landlordId);
        const { journalIncomingPayment } = await import(
          "@/lib/accounting/auto-entries"
        );
        journalIncomingPayment(payment.id).catch((e) =>
          console.error("[accounting] Payment journal failed:", e)
        );
      }
    } catch (e) {
      console.error("[accounting] Trigger error:", e);
    }

    // Emit payment.created event
    emit({
      eventType: "payment.created",
      aggregateType: "Payment",
      aggregateId: payment.id,
      payload: {
        tenantId: profile.id,
        unitId: profile.unit.id,
        amount: baseAmount,
        paymentMethod: data.paymentMethod,
        totalCharged: chargeAmount,
      },
      emittedBy: session.user.id,
    }).catch(console.error);

    return NextResponse.json(
      {
        ...payment,
        surchargeAmount,
        landlordFee,
        totalCharged: chargeAmount,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

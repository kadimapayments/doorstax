export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAdminContext, canAdmin } from "@/lib/admin-context";
import { db } from "@/lib/db";
import { chargeSchema } from "@/lib/validations/charge";
import { getMerchantCredentials } from "@/lib/kadima/merchant-context";
import { merchantCreateSaleFromVault } from "@/lib/kadima/merchant-gateway";
import { checkMerchantApproval } from "@/lib/kadima/merchant-guard";
import { recordPayment, periodKeyFromDate } from "@/lib/ledger";
import { auditLog } from "@/lib/audit";
import { z } from "zod";

/**
 * POST /api/admin/charge
 *
 * Admin Virtual Terminal — run a card charge against a tenant's vaulted
 * card using that tenant's PM's merchant credentials (the PM's MID,
 * terminal, and per-merchant API key). This is what lets DoorStax staff
 * take a phone-in payment on behalf of a PM without impersonating them.
 *
 * Funds flow to the PM's bank (the PM's MID owns the deposit), NOT
 * DoorStax's platform MID. The admin is just the one pressing the
 * button — the merchant of record is always the PM.
 *
 * Gated by `admin:payments`.
 *
 * Body: same shape as /api/payments/charge (chargeSchema): tenantId,
 *       unitId, amount, type, description, source.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const adminCtx = await getAdminContext(session.user.id);
  if (!canAdmin(adminCtx, "admin:payments")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const data = chargeSchema.parse(body);

    // Look up the tenant + unit + property so we can (a) verify the
    // tenant is actually in that unit, and (b) pull the PM that owns
    // the property — that's the merchant of record.
    const tenant = await db.tenantProfile.findFirst({
      where: {
        id: data.tenantId,
        unitId: data.unitId,
      },
      include: {
        unit: {
          include: {
            property: {
              select: { landlordId: true, kadimaTerminalId: true },
            },
          },
        },
      },
    });

    if (!tenant || !tenant.unit?.property?.landlordId) {
      return NextResponse.json(
        { error: "Tenant / unit / property not found" },
        { status: 404 }
      );
    }

    const landlordId = tenant.unit.property.landlordId;

    // PM's merchant must be approved — otherwise the gateway would
    // reject the charge anyway. Better to fail fast with a useful
    // message than get a cryptic gateway error.
    const approvalCheck = await checkMerchantApproval(landlordId);
    if (!approvalCheck.approved) {
      return NextResponse.json(
        {
          error:
            approvalCheck.reason ||
            "The PM's merchant account is not approved for payments yet — charge cannot be run.",
        },
        { status: 403 }
      );
    }

    // Record the Payment row up front in PENDING so we have an ID if
    // anything goes wrong; the admin source string is important for
    // the audit trail (not "virtual-terminal" but explicitly admin).
    const payment = await db.payment.create({
      data: {
        tenantId: data.tenantId,
        unitId: data.unitId,
        landlordId,
        amount: data.amount,
        type: data.type,
        status: "PENDING",
        dueDate: new Date(),
        description: data.description,
        paymentMethod: "card",
        source: data.source || "admin-vt",
      },
    });

    if (!tenant.kadimaCustomerId || !tenant.kadimaCardTokenId) {
      // No vault credentials — leave payment as PENDING but surface
      // the real problem to the admin.
      return NextResponse.json(
        {
          success: false,
          paymentId: payment.id,
          charged: false,
          error:
            "Tenant has no saved card on file. Ask the tenant to save one in their portal before you can charge.",
        },
        { status: 400 }
      );
    }

    // Run the charge through the PM's merchant creds
    try {
      const merchantCreds = await getMerchantCredentials(landlordId);
      const result = await merchantCreateSaleFromVault(merchantCreds, {
        cardToken: tenant.kadimaCardTokenId,
        amount: data.amount,
        terminalIdOverride:
          tenant.unit.property.kadimaTerminalId || undefined,
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
            failedReason: `Gateway declined: ${
              result.status?.reason || result.status?.status || "unknown"
            }`,
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
          description: `Admin VT charge — ${data.description || data.type}`,
        }).catch((e) => console.error("[ledger] Admin VT entry failed:", e));
      }

      auditLog({
        userId: session.user.id,
        userRole: "ADMIN",
        action: approved ? "PAY" : "FAIL",
        objectType: "Payment",
        objectId: payment.id,
        description: `Admin VT charge $${Number(data.amount).toFixed(
          2
        )} → tenant ${data.tenantId} on PM ${landlordId} (${
          approved ? "approved" : "declined"
        })`,
        req,
      });

      return NextResponse.json({
        success: true,
        paymentId: payment.id,
        charged: approved,
        ...(approved && { transactionId: String(result.id) }),
        ...(!approved && {
          error: `Card declined: ${
            result.status?.reason || result.status?.status || "unknown"
          }`,
        }),
      });
    } catch (chargeErr: unknown) {
      const errMsg =
        chargeErr instanceof Error ? chargeErr.message : "Payment gateway error";
      await db.payment.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          kadimaStatus: "gateway_error",
          failedReason: errMsg,
          processedAt: new Date(),
        },
      });
      auditLog({
        userId: session.user.id,
        userRole: "ADMIN",
        action: "FAIL",
        objectType: "Payment",
        objectId: payment.id,
        description: `Admin VT charge failed: ${errMsg}`,
        req,
      });
      return NextResponse.json(
        {
          success: false,
          paymentId: payment.id,
          charged: false,
          error: `Gateway error: ${errMsg}`,
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
    console.error("POST /api/admin/charge error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

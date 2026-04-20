import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveApiLandlord } from "@/lib/api-landlord";
import { chargeSchema } from "@/lib/validations/charge";
import { getMerchantCredentials } from "@/lib/kadima/merchant-context";
import { merchantCreateSaleFromVault } from "@/lib/kadima/merchant-gateway";
import { checkMerchantApproval } from "@/lib/kadima/merchant-guard";
import { z } from "zod";
import { recordPayment, periodKeyFromDate } from "@/lib/ledger";

export async function POST(req: Request) {
  const ctx = await resolveApiLandlord();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = chargeSchema.parse(body);

    // Verify landlord owns this unit and tenant is assigned
    const tenant = await db.tenantProfile.findFirst({
      where: {
        id: data.tenantId,
        unitId: data.unitId,
        unit: { property: { landlordId: ctx.landlordId } },
      },
      include: {
        unit: {
          include: { property: { select: { kadimaTerminalId: true } } },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant or unit not found" },
        { status: 404 }
      );
    }

    // Verify PM's merchant application is approved
    const approvalCheck = await checkMerchantApproval(ctx.landlordId);
    if (!approvalCheck.approved) {
      return NextResponse.json(
        { error: approvalCheck.reason || "Merchant account not approved for payments" },
        { status: 403 }
      );
    }

    // Create payment record
    const payment = await db.payment.create({
      data: {
        tenantId: data.tenantId,
        unitId: data.unitId,
        landlordId: ctx.landlordId,
        amount: data.amount,
        type: data.type,
        status: "PENDING",
        dueDate: new Date(),
        description: data.description,
        paymentMethod: "card",
        source: data.source || null,
      },
    });

    // If tenant has vault credentials, attempt to charge via Kadima
    if (tenant.kadimaCustomerId && tenant.kadimaCardTokenId) {
      try {
        // ─── Vault Card Verification ─────────────────────────
        // Verify the card token actually exists before charging
        try {
          const { listCards } = await import("@/lib/kadima/customer-vault");
          const vaultCards = await listCards(tenant.kadimaCustomerId);
          const cardExists = vaultCards.items?.some(
            (c: { id?: number | string; token?: string }) =>
              String(c.id) === tenant.kadimaCardTokenId || String(c.token) === tenant.kadimaCardTokenId
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
              { success: false, paymentId: payment.id, charged: false, error: "Tenant's saved card is no longer available" },
              { status: 400 }
            );
          }
        } catch (vaultErr) {
          console.error("[charge] Vault card verification failed:", vaultErr);
          // Non-blocking — proceed with charge attempt
        }

        // Resolve the PM's merchant credentials for this payment
        const merchantCreds = await getMerchantCredentials(ctx.landlordId);

        const result = await merchantCreateSaleFromVault(merchantCreds, {
          cardToken: tenant.kadimaCardTokenId,
          amount: data.amount,
          // Property-level terminal override
          terminalIdOverride: tenant.unit?.property?.kadimaTerminalId || undefined,
        });

        // Kadima gateway returns the transaction directly (not wrapped).
        // Status is nested: result.status.status = "Approved" | "Decline" | "Error"
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

        // Record immutable ledger entry if charge succeeded
        if (approved) {
          recordPayment({
            tenantId: data.tenantId,
            unitId: data.unitId,
            paymentId: payment.id,
            amount: data.amount,
            periodKey: periodKeyFromDate(new Date()),
            description: `PM charge — ${data.description || data.type}`,
          }).catch((e) => console.error("[ledger] PM charge entry failed:", e));
        }

        return NextResponse.json(
          { success: true, paymentId: payment.id, charged: true },
          { status: 201 }
        );
      } catch (chargeErr: unknown) {
        const errMsg = chargeErr instanceof Error ? chargeErr.message : "Payment gateway error";
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
            success: true,
            paymentId: payment.id,
            charged: false,
            error: "Payment gateway error — payment recorded as failed",
          },
          { status: 201 }
        );
      }
    }

    // No vault credentials — record as pending
    return NextResponse.json(
      {
        success: true,
        paymentId: payment.id,
        charged: false,
        message: "Payment recorded. Tenant has no saved payment method.",
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

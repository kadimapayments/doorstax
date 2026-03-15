import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { chargeSchema } from "@/lib/validations/charge";
import { createSaleFromVault } from "@/lib/kadima/gateway";
import { z } from "zod";
import { recordPayment, periodKeyFromDate } from "@/lib/ledger";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
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
        unit: { property: { landlordId: session.user.id } },
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

    // Create payment record
    const payment = await db.payment.create({
      data: {
        tenantId: data.tenantId,
        unitId: data.unitId,
        landlordId: session.user.id,
        amount: data.amount,
        type: data.type,
        status: "PENDING",
        dueDate: new Date(),
        description: data.description,
        paymentMethod: "card",
      },
    });

    // If tenant has vault credentials, attempt to charge via Kadima
    if (tenant.kadimaCustomerId && tenant.kadimaCardTokenId) {
      try {
        const terminalId =
          tenant.unit?.property?.kadimaTerminalId || undefined;

        const result = await createSaleFromVault({
          customerId: tenant.kadimaCustomerId,
          cardId: tenant.kadimaCardTokenId,
          amount: data.amount,
          terminalId,
        });

        const cardBrand = result.data?.cardType
          ? String(result.data.cardType).toLowerCase()
          : undefined;
        const cardLast4 = result.data?.lastFour
          ? String(result.data.lastFour)
          : undefined;

        await db.payment.update({
          where: { id: payment.id },
          data: {
            status: result.data ? "COMPLETED" : "FAILED",
            kadimaTransactionId: result.data?.id,
            kadimaStatus: result.data?.status,
            paidAt: result.data ? new Date() : null,
            ...(cardBrand && { cardBrand }),
            ...(cardLast4 && { cardLast4 }),
          },
        });

        // Record immutable ledger entry if charge succeeded
        if (result.data) {
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
      } catch {
        await db.payment.update({
          where: { id: payment.id },
          data: { status: "FAILED", kadimaStatus: "gateway_error" },
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

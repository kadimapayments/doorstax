import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as recurring from "@/lib/kadima/recurring";
import { emit } from "@/lib/events/emitter";
import { canCancelAutopay, calculateNextChargeDate } from "@/lib/autopay-engine";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "TENANT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await db.tenantProfile.findUnique({
    where: { userId: session.user.id },
    include: { unit: true },
  });

  if (!profile || !profile.unit || !profile.kadimaCustomerId) {
    return NextResponse.json(
      { error: "Setup a payment method first" },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();
    const { cardId, accountId, paymentMethod } = body as {
      cardId?: string;
      accountId?: string;
      paymentMethod?: string;
    };

    // Determine payment method
    const method = paymentMethod === "ACH" || accountId ? "ACH" : "CARD";

    // Use provided IDs or fall back to profile's saved card/account
    const effectiveCardId = cardId || (method === "CARD" ? profile.kadimaCardTokenId : undefined) || undefined;
    const effectiveAccountId = accountId || (method === "ACH" ? profile.kadimaAccountId : undefined) || undefined;

    // Create recurring payment at Kadima
    const result = await recurring.createRecurringPayment(
      profile.kadimaCustomerId,
      {
        amount: Number(profile.unit.rentAmount),
        execute: { frequency: 1, period: "month" },
        valid: {
          from: new Date().toISOString().split("T")[0],
        },
        cardId: effectiveCardId,
        accountId: effectiveAccountId,
      }
    );

    // Calculate next charge date
    const nextChargeDate = calculateNextChargeDate(profile.unit.dueDay);

    // Mirror locally
    await db.recurringBilling.create({
      data: {
        tenantId: profile.id,
        unitId: profile.unit.id,
        kadimaRecurringId: result.data?.id,
        amount: profile.unit.rentAmount,
        dayOfMonth: profile.unit.dueDay,
        startDate: new Date(),
        status: "ACTIVE",
        paymentMethod: method,
        nextChargeDate,
        failedAttempts: 0,
      },
    });

    await db.tenantProfile.update({
      where: { id: profile.id },
      data: { autopayEnabled: true },
    });

    // Emit event
    emit({
      eventType: "autopay.enrolled",
      aggregateType: "RecurringBilling",
      aggregateId: profile.id,
      payload: {
        tenantId: profile.id,
        unitId: profile.unit.id,
        amount: Number(profile.unit.rentAmount),
        paymentMethod: method,
        nextChargeDate: nextChargeDate.toISOString(),
      },
      emittedBy: session.user.id,
    }).catch(console.error);

    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to enable autopay" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user || session.user.role !== "TENANT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await db.tenantProfile.findUnique({
    where: { userId: session.user.id },
    include: { recurringBilling: true },
  });

  if (!profile?.recurringBilling || !profile.kadimaCustomerId) {
    return NextResponse.json({ error: "No autopay to cancel" }, { status: 400 });
  }

  // Check cancellation rules
  const cancelCheck = await canCancelAutopay(profile.id);
  if (!cancelCheck.allowed) {
    return NextResponse.json(
      { error: cancelCheck.reason },
      { status: 403 }
    );
  }

  try {
    // Archive at Kadima
    if (profile.recurringBilling.kadimaRecurringId) {
      await recurring.archiveRecurringPayment(
        profile.kadimaCustomerId,
        profile.recurringBilling.kadimaRecurringId
      );
    }

    // Update local state
    await db.recurringBilling.update({
      where: { id: profile.recurringBilling.id },
      data: { status: "CANCELLED" },
    });

    await db.tenantProfile.update({
      where: { id: profile.id },
      data: { autopayEnabled: false },
    });

    // Emit event
    emit({
      eventType: "autopay.cancelled",
      aggregateType: "RecurringBilling",
      aggregateId: profile.id,
      payload: { tenantId: profile.id },
      emittedBy: session.user.id,
    }).catch(console.error);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to cancel autopay" },
      { status: 500 }
    );
  }
}

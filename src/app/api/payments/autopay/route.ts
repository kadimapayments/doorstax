import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as recurring from "@/lib/kadima/recurring";
import { listCards } from "@/lib/kadima/customer-vault";
import { emit } from "@/lib/events/emitter";
import { canCancelAutopay, calculateNextChargeDate } from "@/lib/autopay-engine";
import { resolveRent } from "@/lib/rent-resolver";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "TENANT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await db.tenantProfile.findUnique({
    where: { userId: session.user.id },
    include: { unit: { include: { property: { select: { kadimaTerminalId: true } } } } },
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

    // Determine terminal ID
    const terminalId = Number(
      profile.unit?.property?.kadimaTerminalId
        || process.env.KADIMA_TERMINAL_ID
    );
    if (!terminalId) {
      return NextResponse.json(
        { error: "No terminal configured for this property. Contact your property manager." },
        { status: 400 }
      );
    }

    // Build nested customer payment method reference per Kadima docs.
    // Kadima recurring needs the numeric CARD ID, not the card token.
    // kadimaCardTokenId may store a token string (e.g. "BpybLujXAyXC7556")
    // or a numeric ID. If it's not numeric, look up the card ID from the vault.
    const customerRef: { card?: { id: number }; account?: { id: number } } = {};
    if (method === "CARD" && effectiveCardId) {
      let numericCardId = Number(effectiveCardId);
      if (isNaN(numericCardId) && profile.kadimaCustomerId) {
        // effectiveCardId is a token string — resolve numeric card ID from vault
        try {
          const cardsRes = await listCards(profile.kadimaCustomerId);
          const cards = cardsRes?.items || [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const matchedCard = cards.find((c: any) =>
            String(c.token) === effectiveCardId || String(c.id) === effectiveCardId
          );
          if (matchedCard) {
            numericCardId = Number(matchedCard.id);
            console.log(`[autopay] Resolved card token "${effectiveCardId}" → card ID ${numericCardId}`);
          } else {
            // Fall back to latest card
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const latest = cards.reduce((a: any, b: any) => (Number(b.id) > Number(a.id) ? b : a), cards[0]);
            if (latest) {
              numericCardId = Number(latest.id);
              console.log(`[autopay] Token not matched, using latest card ID ${numericCardId}`);
            }
          }
        } catch (lookupErr) {
          console.error("[autopay] Failed to look up card ID from vault:", lookupErr);
        }
      }
      if (isNaN(numericCardId) || numericCardId <= 0) {
        return NextResponse.json(
          { error: "No valid payment card found. Please add a card first." },
          { status: 400 }
        );
      }
      customerRef.card = { id: numericCardId };
    } else if (method === "ACH" && effectiveAccountId) {
      customerRef.account = { id: Number(effectiveAccountId) };
    }

    // Resolve rent via the active-lease-first helper. Using
    // Unit.rentAmount directly would silently drift from the lease
    // the tenant actually signed — see the rent-migration plan.
    const rentInfo = await resolveRent(profile.id);
    if (!rentInfo) {
      return NextResponse.json(
        { error: "No unit assignment found" },
        { status: 400 }
      );
    }
    const enrolledAmount = rentInfo.effectiveAmount;

    // Create recurring payment at Kadima
    const unitNumber = profile.unit?.unitNumber || "Unknown";
    const result = await recurring.createRecurringPayment(
      profile.kadimaCustomerId,
      {
        name: `Monthly Rent - Unit ${unitNumber}`,
        amount: enrolledAmount,
        execute: { frequency: 1, period: "month" },
        valid: {
          from: new Date().toISOString().split("T")[0],
        },
        terminal: { id: terminalId },
        customer: customerRef,
      }
    );

    // Calculate next charge date
    const nextChargeDate = calculateNextChargeDate(profile.unit.dueDay);

    // Mirror locally
    await db.recurringBilling.create({
      data: {
        tenantId: profile.id,
        unitId: profile.unit.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        kadimaRecurringId: (result as any)?.id || (result as any)?.data?.id,
        amount: enrolledAmount,
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
        amount: enrolledAmount,
        rentSource: rentInfo.source,
        paymentMethod: method,
        nextChargeDate: nextChargeDate.toISOString(),
      },
      emittedBy: session.user.id,
    }).catch(console.error);

    return NextResponse.json({ success: true }, { status: 201 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error("[autopay] Failed to create recurring:", {
      message: err?.message,
      status: err?.response?.status,
      data: JSON.stringify(err?.response?.data),
      customerId: profile.kadimaCustomerId,
      terminalId: profile.unit?.property?.kadimaTerminalId || process.env.KADIMA_TERMINAL_ID,
      savedCardId: profile.kadimaCardTokenId,
      savedAccountId: profile.kadimaAccountId,
    });
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

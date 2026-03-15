import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWebhookSignature, parseWebhookEvent } from "@/lib/kadima/webhooks";
import { notify } from "@/lib/notifications";
import { paymentReceivedHtml } from "@/lib/emails/payment-received";
import { paymentFailedHtml, paymentFailedPmHtml } from "@/lib/emails/payment-failed";
import { auditLog } from "@/lib/audit";
import { recordPayment, recordReversal, periodKeyFromDate } from "@/lib/ledger";
import { webhookLimiter, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { emit } from "@/lib/events/emitter";
import { handleAutopayFailure, calculateNextChargeDate } from "@/lib/autopay-engine";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Look up tenant user + PM info for a payment by kadimaTransactionId */
async function lookupPaymentContext(kadimaTransactionId: string) {
  return db.payment.findFirst({
    where: { kadimaTransactionId },
    include: {
      tenant: { include: { user: { select: { id: true, name: true, email: true } } } },
      landlord: { select: { id: true, name: true, email: true } },
      unit: { include: { property: { select: { name: true } } } },
    },
  });
}

function formatCurrency(amount: number | string | { toString(): string }) {
  return `$${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function extractCardDetails(data: Record<string, unknown>) {
  return {
    cardBrand: data.cardType ? String(data.cardType).toLowerCase() : undefined,
    cardLast4: data.lastFour ? String(data.lastFour) : undefined,
    achLast4: data.accountNumber ? String(data.accountNumber).slice(-4) : undefined,
  };
}

/* ------------------------------------------------------------------ */
/*  Event Handlers                                                     */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleCompleted(event: any) {
  const transactionId = event.data.id;
  if (!transactionId) return;

  const { cardBrand, cardLast4, achLast4 } = extractCardDetails(event.data);

  await db.payment.updateMany({
    where: { kadimaTransactionId: transactionId },
    data: {
      status: "COMPLETED",
      kadimaStatus: event.data.status,
      paidAt: new Date(),
      ...(cardBrand && { cardBrand }),
      ...(cardLast4 && { cardLast4 }),
      ...(achLast4 && { achLast4 }),
    },
  });

  // Check if this is a payout ACH credit
  const payoutCompleted = await db.ownerPayout.findFirst({
    where: { kadimaTransactionId: transactionId },
  });
  if (payoutCompleted) {
    await db.ownerPayout.update({
      where: { id: payoutCompleted.id },
      data: { status: "PAID", paidAt: new Date() },
    });
  }

  auditLog({
    action: "UPDATE",
    objectType: "Payment",
    objectId: transactionId,
    description: `Payment completed (${event.event})`,
    newValue: { status: "COMPLETED", kadimaStatus: event.data.status },
  });

  // Record immutable ledger entry — AWAITED (not fire-and-forget)
  const completedPayment = await db.payment.findFirst({
    where: { kadimaTransactionId: transactionId },
    select: { id: true, tenantId: true, unitId: true, amount: true, dueDate: true },
  });
  if (completedPayment) {
    await recordPayment({
      tenantId: completedPayment.tenantId,
      unitId: completedPayment.unitId,
      paymentId: completedPayment.id,
      amount: completedPayment.amount,
      periodKey: periodKeyFromDate(completedPayment.dueDate),
      description: `Payment received (${event.event})`,
    });
  }

  // Notifications remain fire-and-forget (non-critical)
  const ctx = await lookupPaymentContext(transactionId);
  if (ctx) {
    const amt = formatCurrency(ctx.amount);
    const method = ctx.paymentMethod === "ach" ? "ACH Bank Transfer" : `Card ending ${ctx.cardLast4 || "****"}`;
    const propertyName = ctx.unit?.property?.name || "your property";
    const tenantUser = ctx.tenant?.user;
    const pm = ctx.landlord;

    if (tenantUser) {
      notify({
        userId: tenantUser.id,
        createdById: pm.id,
        type: "PAYMENT_RECEIVED",
        title: "Payment Received",
        message: `Your ${amt} payment for ${propertyName} has been processed.`,
        severity: "info",
        amount: Number(ctx.amount),
        email: tenantUser.email ? {
          to: tenantUser.email,
          subject: `Payment Received — ${amt}`,
          html: paymentReceivedHtml({
            tenantName: tenantUser.name || "Tenant",
            amount: amt,
            paymentMethod: method,
            propertyName,
            date: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
          }),
        } : undefined,
      }).catch(console.error);
    }

    notify({
      userId: pm.id,
      createdById: pm.id,
      type: "PAYMENT_RECEIVED",
      title: "Payment Received",
      message: `${tenantUser?.name || "A tenant"} paid ${amt} for ${propertyName}.`,
      severity: "info",
      amount: Number(ctx.amount),
    }).catch(console.error);
  }

  // Emit domain event
  const succeededPayment = await db.payment.findFirst({
    where: { kadimaTransactionId: transactionId },
    select: { id: true, tenantId: true, unitId: true, amount: true },
  });
  if (succeededPayment) {
    emit({
      eventType: "payment.succeeded",
      aggregateType: "Payment",
      aggregateId: succeededPayment.id,
      payload: {
        tenantId: succeededPayment.tenantId,
        unitId: succeededPayment.unitId,
        amount: Number(succeededPayment.amount),
        kadimaTransactionId: transactionId,
        eventType: event.event,
      },
      emittedBy: "system",
    }).catch(console.error);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleFailed(event: any) {
  const transactionId = event.data.id;
  if (!transactionId) return;

  const { cardBrand, cardLast4, achLast4 } = extractCardDetails(event.data);
  const declineReasonCode = event.data.responseCode
    ? String(event.data.responseCode)
    : event.data.declineReason
    ? String(event.data.declineReason)
    : undefined;

  await db.payment.updateMany({
    where: { kadimaTransactionId: transactionId },
    data: {
      status: "FAILED",
      kadimaStatus: event.data.status,
      ...(cardBrand && { cardBrand }),
      ...(cardLast4 && { cardLast4 }),
      ...(achLast4 && { achLast4 }),
      ...(declineReasonCode && { declineReasonCode }),
    },
  });

  auditLog({
    action: "UPDATE",
    objectType: "Payment",
    objectId: transactionId,
    description: `Payment failed (${event.event})`,
    newValue: { status: "FAILED", kadimaStatus: event.data.status, declineReasonCode },
  });

  // Check if this is a payout ACH credit
  const payoutFailed = await db.ownerPayout.findFirst({
    where: { kadimaTransactionId: transactionId },
  });
  if (payoutFailed) {
    await db.ownerPayout.update({
      where: { id: payoutFailed.id },
      data: { status: "FAILED" },
    });
  }

  // Notifications (fire-and-forget)
  const ctx = await lookupPaymentContext(transactionId);
  if (ctx) {
    const amt = formatCurrency(ctx.amount);
    const reason = declineReasonCode || "Payment declined";
    const propertyName = ctx.unit?.property?.name || "your property";
    const tenantUser = ctx.tenant?.user;
    const pm = ctx.landlord;

    if (tenantUser) {
      notify({
        userId: tenantUser.id,
        createdById: pm.id,
        type: "PAYMENT_FAILED",
        title: "Payment Failed",
        message: `Your ${amt} payment for ${propertyName} was declined. Please update your payment method and try again.`,
        severity: "urgent",
        amount: Number(ctx.amount),
        email: tenantUser.email ? {
          to: tenantUser.email,
          subject: `Payment Failed — ${amt}`,
          html: paymentFailedHtml({
            tenantName: tenantUser.name || "Tenant",
            amount: amt,
            reason,
            propertyName,
          }),
        } : undefined,
      }).catch(console.error);
    }

    notify({
      userId: pm.id,
      createdById: pm.id,
      type: "PAYMENT_FAILED",
      title: "Tenant Payment Failed",
      message: `Payment of ${amt} from ${tenantUser?.name || "a tenant"} for ${propertyName} failed.`,
      severity: "warning",
      amount: Number(ctx.amount),
      email: pm.email ? {
        to: pm.email,
        subject: `Tenant Payment Failed — ${amt}`,
        html: paymentFailedPmHtml({
          pmName: pm.name || "Property Manager",
          tenantName: tenantUser?.name || "A tenant",
          amount: amt,
          reason,
          propertyName,
        }),
      } : undefined,
    }).catch(console.error);

    // Handle autopay failure tracking
    if (ctx.tenantId) {
      const billing = await db.recurringBilling.findUnique({
        where: { tenantId: ctx.tenantId },
      });
      if (billing?.status === "ACTIVE") {
        handleAutopayFailure(ctx.tenantId, reason).catch(console.error);
      }
    }
  }

  // Emit domain event
  const failedPayment = await db.payment.findFirst({
    where: { kadimaTransactionId: transactionId },
    select: { id: true, tenantId: true, unitId: true, amount: true },
  });
  if (failedPayment) {
    emit({
      eventType: "payment.failed",
      aggregateType: "Payment",
      aggregateId: failedPayment.id,
      payload: {
        tenantId: failedPayment.tenantId,
        unitId: failedPayment.unitId,
        amount: Number(failedPayment.amount),
        kadimaTransactionId: transactionId,
        declineReasonCode,
      },
      emittedBy: "system",
    }).catch(console.error);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleRefunded(event: any) {
  const transactionId = event.data.id;
  if (!transactionId) return;

  const { cardBrand, cardLast4, achLast4 } = extractCardDetails(event.data);

  await db.payment.updateMany({
    where: { kadimaTransactionId: transactionId },
    data: {
      status: "REFUNDED",
      kadimaStatus: event.data.status,
      ...(cardBrand && { cardBrand }),
      ...(cardLast4 && { cardLast4 }),
      ...(achLast4 && { achLast4 }),
    },
  });

  auditLog({
    action: "REFUND",
    objectType: "Payment",
    objectId: transactionId,
    description: `Payment refunded/returned (${event.event})`,
    newValue: { status: "REFUNDED", kadimaStatus: event.data.status },
  });

  // Record immutable ledger reversal — AWAITED
  const refundedPayment = await db.payment.findFirst({
    where: { kadimaTransactionId: transactionId },
    select: { id: true, tenantId: true, unitId: true, amount: true, dueDate: true },
  });
  if (refundedPayment) {
    await recordReversal({
      tenantId: refundedPayment.tenantId,
      unitId: refundedPayment.unitId,
      paymentId: refundedPayment.id,
      amount: refundedPayment.amount,
      periodKey: periodKeyFromDate(refundedPayment.dueDate),
      reason: event.event === "ach.returned" ? "ACH return" : "Refund",
    });
  }

  // Check if this is a payout ACH credit (returned = failed)
  const payoutReturned = await db.ownerPayout.findFirst({
    where: { kadimaTransactionId: transactionId },
  });
  if (payoutReturned) {
    await db.ownerPayout.update({
      where: { id: payoutReturned.id },
      data: { status: "FAILED" },
    });
  }

  // Notifications (fire-and-forget)
  const ctx = await lookupPaymentContext(transactionId);
  if (ctx) {
    const amt = formatCurrency(ctx.amount);
    const propertyName = ctx.unit?.property?.name || "your property";
    const tenantUser = ctx.tenant?.user;
    const pm = ctx.landlord;

    if (tenantUser) {
      notify({
        userId: tenantUser.id,
        createdById: pm.id,
        type: "PAYMENT_REFUNDED",
        title: "Payment Refunded",
        message: `Your ${amt} payment for ${propertyName} has been refunded.`,
        severity: "info",
        amount: Number(ctx.amount),
      }).catch(console.error);
    }

    notify({
      userId: pm.id,
      createdById: pm.id,
      type: "PAYMENT_REFUNDED",
      title: "Payment Refunded",
      message: `Refund of ${amt} processed for ${tenantUser?.name || "a tenant"} at ${propertyName}.`,
      severity: "info",
      amount: Number(ctx.amount),
    }).catch(console.error);
  }

  // Emit domain event
  if (refundedPayment) {
    emit({
      eventType: "payment.refunded",
      aggregateType: "Payment",
      aggregateId: refundedPayment.id,
      payload: {
        tenantId: refundedPayment.tenantId,
        unitId: refundedPayment.unitId,
        amount: Number(refundedPayment.amount),
        kadimaTransactionId: transactionId,
        reason: event.event === "ach.returned" ? "ACH return" : "Refund",
      },
      emittedBy: "system",
    }).catch(console.error);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleRecurring(event: any) {
  if (!event.data.customerId || !event.data.amount) return;

  const profile = await db.tenantProfile.findFirst({
    where: { kadimaCustomerId: event.data.customerId },
    include: {
      unit: { include: { property: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });

  if (!profile || !profile.unit) return;

  const { cardBrand, cardLast4, achLast4 } = extractCardDetails(event.data);

  const recurringPayment = await db.payment.create({
    data: {
      tenantId: profile.id,
      unitId: profile.unit.id,
      landlordId: profile.unit.property.landlordId,
      amount: event.data.amount,
      type: "RENT",
      status: "COMPLETED",
      paymentMethod: "ach",
      kadimaTransactionId: event.data.id,
      kadimaStatus: event.data.status,
      dueDate: new Date(),
      paidAt: new Date(),
      ...(cardBrand && { cardBrand }),
      ...(cardLast4 && { cardLast4 }),
      ...(achLast4 && { achLast4 }),
    },
  });

  // Record immutable ledger entry — AWAITED
  await recordPayment({
    tenantId: profile.id,
    unitId: profile.unit.id,
    paymentId: recurringPayment.id,
    amount: event.data.amount,
    periodKey: periodKeyFromDate(new Date()),
    description: "Autopay payment received",
  });

  // Notifications (fire-and-forget)
  const amt = formatCurrency(event.data.amount);
  const propertyName = profile.unit.property.name || "your property";
  const method = achLast4 ? `ACH ending ${achLast4}` : cardLast4 ? `Card ending ${cardLast4}` : "Autopay";

  if (profile.user) {
    notify({
      userId: profile.user.id,
      createdById: profile.unit.property.landlordId,
      type: "PAYMENT_RECEIVED",
      title: "Autopay Payment Processed",
      message: `Your autopay payment of ${amt} for ${propertyName} has been processed.`,
      severity: "info",
      amount: Number(event.data.amount),
      email: profile.user.email ? {
        to: profile.user.email,
        subject: `Autopay Payment Processed — ${amt}`,
        html: paymentReceivedHtml({
          tenantName: profile.user.name || "Tenant",
          amount: amt,
          paymentMethod: method,
          propertyName,
          date: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
        }),
      } : undefined,
    }).catch(console.error);
  }

  // Update RecurringBilling tracking
  const billing = await db.recurringBilling.findUnique({
    where: { tenantId: profile.id },
  });
  if (billing) {
    const nextChargeDate = calculateNextChargeDate(billing.dayOfMonth);
    await db.recurringBilling.update({
      where: { id: billing.id },
      data: {
        lastChargeDate: new Date(),
        nextChargeDate,
        failedAttempts: 0,
        lastFailureReason: null,
      },
    });
  }

  // Emit domain event
  emit({
    eventType: "payment.succeeded",
    aggregateType: "Payment",
    aggregateId: recurringPayment.id,
    payload: {
      tenantId: profile.id,
      unitId: profile.unit.id,
      amount: Number(event.data.amount),
      kadimaTransactionId: event.data.id,
      autopay: true,
    },
    emittedBy: "system",
  }).catch(console.error);
}

/* ------------------------------------------------------------------ */
/*  Route Handler (with idempotency)                                   */
/* ------------------------------------------------------------------ */

export async function POST(req: Request) {
  // ─── Rate Limiting (by IP) ──────────────────────────────────
  const rlIp = getClientIp(req);
  const rl = await webhookLimiter.limit(rlIp);
  if (!rl.success) return rateLimitResponse(rl.reset);

  const rawBody = await req.text();
  const signature = req.headers.get("x-kadima-signature") || "";

  // Verify HMAC-SHA256 signature (checks both merchant + processor secrets)
  const sigResult = verifyWebhookSignature(rawBody, signature);
  if (!sigResult.valid) {
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 401 }
    );
  }

  try {
    const event = parseWebhookEvent(rawBody);
    console.log(`[Webhook] Received ${event.event} from ${sigResult.source} tier`);

    // ─── Idempotency Guard ─────────────────────────────────────
    const eventId = `${event.data?.id || "unknown"}:${event.event}`;
    const payload = JSON.parse(rawBody);

    // Try to create the WebhookEvent record (unique on eventId)
    try {
      await db.webhookEvent.create({
        data: { eventId, eventType: event.event, payload, status: "RECEIVED" },
      });
    } catch (err: unknown) {
      // P2002 = unique constraint violation → duplicate event
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        // Check if already processed
        const existing = await db.webhookEvent.findUnique({
          where: { eventId },
          select: { status: true },
        });
        if (existing?.status === "PROCESSED") {
          return NextResponse.json({ received: true, deduplicated: true });
        }
        // If FAILED or PROCESSING, let it retry below
      } else {
        throw err;
      }
    }

    // Mark as PROCESSING
    await db.webhookEvent.update({
      where: { eventId },
      data: { status: "PROCESSING", attempts: { increment: 1 } },
    });

    try {
      // ─── Dispatch to handler ─────────────────────────────────
      switch (event.event) {
        case "ach.completed":
        case "transaction.completed":
          await handleCompleted(event);
          break;
        case "ach.failed":
        case "transaction.failed":
          await handleFailed(event);
          break;
        case "ach.returned":
        case "transaction.refunded":
          await handleRefunded(event);
          break;
        case "recurring.processed":
          await handleRecurring(event);
          break;
        default:
          // Unhandled event type — mark as processed (nothing to do)
          break;
      }

      // Mark as PROCESSED
      await db.webhookEvent.update({
        where: { eventId },
        data: { status: "PROCESSED", processedAt: new Date() },
      });

      return NextResponse.json({ received: true });
    } catch (handlerError) {
      // Handler failed — mark as FAILED so retry cron can pick it up
      const errorMessage =
        handlerError instanceof Error
          ? handlerError.message
          : String(handlerError);

      await db.webhookEvent.update({
        where: { eventId },
        data: { status: "FAILED", lastError: errorMessage },
      });

      console.error("[Webhook] Handler error:", handlerError);
      // Return 500 so Kadima retries the webhook
      return NextResponse.json(
        { error: "Webhook processing failed" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[Webhook] Processing error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

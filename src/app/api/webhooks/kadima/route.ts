import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWebhookSignatureMultiMerchant, parseWebhookEvent } from "@/lib/kadima/webhooks";
import { notify } from "@/lib/notifications";
import { paymentReceivedHtml } from "@/lib/emails/payment-received";
import { paymentFailedHtml, paymentFailedPmHtml } from "@/lib/emails/payment-failed";
import { auditLog } from "@/lib/audit";
import { recordPayment, recordReversal, periodKeyFromDate } from "@/lib/ledger";
import { webhookLimiter, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { emit } from "@/lib/events/emitter";
import { handleAutopayFailure, calculateNextChargeDate } from "@/lib/autopay-engine";
import type { WebhookEvent } from "@/lib/kadima/types";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Construct a human-readable event key from module + action */
function eventKey(event: WebhookEvent): string {
  return `${event.module}.${event.action}`;
}

/**
 * Extract the transaction ID and status from a Kadima webhook event.
 *
 * Card transactions: data.transaction.id, data.transaction.status
 * ACH transactions:  data.id, data.status
 */
function extractTransactionInfo(event: WebhookEvent): {
  transactionId: string | null;
  status: string | null;
  amount: number | null;
  isCardTransaction: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawData: Record<string, any>;
} {
  if (event.module === "transaction" && event.data.transaction) {
    // Card transaction — data is nested under data.transaction
    const txn = event.data.transaction;
    return {
      transactionId: txn.id != null ? String(txn.id) : null,
      status: txn.status ? String(txn.status) : null,
      amount: txn.amount != null ? Number(txn.amount) : null,
      isCardTransaction: true,
      rawData: txn as Record<string, any>,
    };
  } else {
    // ACH or other — data fields are flat
    return {
      transactionId: event.data.id != null ? String(event.data.id) : null,
      status: event.data.status ? String(event.data.status) : null,
      amount: event.data.amount != null ? Number(event.data.amount) : null,
      isCardTransaction: false,
      rawData: event.data as Record<string, any>,
    };
  }
}

/**
 * Map Kadima status strings to our internal status.
 * Kadima uses: "Approved", "Decline", "Error", "Pending", etc.
 */
function mapKadimaStatus(kadimaStatus: string | null): "COMPLETED" | "FAILED" | "PENDING" | null {
  if (!kadimaStatus) return null;
  const s = kadimaStatus.toLowerCase();
  if (s === "approved" || s === "settled" || s === "completed") return "COMPLETED";
  if (s === "decline" || s === "declined" || s === "error" || s === "failed" || s === "returned") return "FAILED";
  if (s === "pending" || s === "processing") return "PENDING";
  return null;
}

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

async function handleCompleted(event: WebhookEvent) {
  const { transactionId, status, rawData } = extractTransactionInfo(event);
  if (!transactionId) return;

  const { cardBrand, cardLast4, achLast4 } = extractCardDetails(rawData);
  const evtKey = eventKey(event);

  await db.payment.updateMany({
    where: { kadimaTransactionId: transactionId },
    data: {
      status: "COMPLETED",
      kadimaStatus: status,
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
    description: `Payment completed (${evtKey})`,
    newValue: { status: "COMPLETED", kadimaStatus: status },
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
      description: `Payment received (${evtKey})`,
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
        eventType: evtKey,
      },
      emittedBy: "system",
    }).catch(console.error);
  }
}

async function handleFailed(event: WebhookEvent) {
  const { transactionId, status, rawData } = extractTransactionInfo(event);
  if (!transactionId) return;

  const { cardBrand, cardLast4, achLast4 } = extractCardDetails(rawData);
  const evtKey = eventKey(event);
  const declineReasonCode = rawData.statusReason
    ? String(rawData.statusReason)
    : rawData.responseCode
    ? String(rawData.responseCode)
    : rawData.declineReason
    ? String(rawData.declineReason)
    : undefined;

  await db.payment.updateMany({
    where: { kadimaTransactionId: transactionId },
    data: {
      status: "FAILED",
      kadimaStatus: status,
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
    description: `Payment failed (${evtKey})`,
    newValue: { status: "FAILED", kadimaStatus: status, declineReasonCode },
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

async function handleRefunded(event: WebhookEvent) {
  const { transactionId, status, rawData } = extractTransactionInfo(event);
  if (!transactionId) return;

  const { cardBrand, cardLast4, achLast4 } = extractCardDetails(rawData);
  const evtKey = eventKey(event);

  await db.payment.updateMany({
    where: { kadimaTransactionId: transactionId },
    data: {
      status: "REFUNDED",
      kadimaStatus: status,
      ...(cardBrand && { cardBrand }),
      ...(cardLast4 && { cardLast4 }),
      ...(achLast4 && { achLast4 }),
    },
  });

  auditLog({
    action: "REFUND",
    objectType: "Payment",
    objectId: transactionId,
    description: `Payment refunded/returned (${evtKey})`,
    newValue: { status: "REFUNDED", kadimaStatus: status },
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
      reason: event.module === "ach" ? "ACH return" : "Refund",
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
        reason: event.module === "ach" ? "ACH return" : "Refund",
      },
      emittedBy: "system",
    }).catch(console.error);
  }
}

async function handleRecurring(event: WebhookEvent) {
  const { transactionId, amount, rawData } = extractTransactionInfo(event);
  const customerId = event.data.transaction?.customerId
    ?? event.data.customerId
    ?? rawData.customerId;
  if (!customerId || !amount) return;

  const profile = await db.tenantProfile.findFirst({
    where: { kadimaCustomerId: String(customerId) },
    include: {
      unit: { include: { property: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });

  if (!profile || !profile.unit) return;

  const { cardBrand, cardLast4, achLast4 } = extractCardDetails(rawData);

  // Look up the recurring billing record to get the actual payment method
  const billing = await db.recurringBilling.findUnique({
    where: { tenantId: profile.id },
    select: { paymentMethod: true },
  });
  const recurringMethod = billing?.paymentMethod?.toLowerCase() === "card" ? "card" : "ach";

  const recurringPayment = await db.payment.create({
    data: {
      tenantId: profile.id,
      unitId: profile.unit.id,
      landlordId: profile.unit.property.landlordId,
      amount,
      type: "RENT",
      status: "COMPLETED",
      paymentMethod: recurringMethod,
      kadimaTransactionId: transactionId,
      kadimaStatus: rawData.status ? String(rawData.status) : "Approved",
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
    amount,
    periodKey: periodKeyFromDate(new Date()),
    description: "Autopay payment received",
  });

  // Notifications (fire-and-forget)
  const amt = formatCurrency(amount);
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
      amount: Number(amount),
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
  const billingRecord = await db.recurringBilling.findUnique({
    where: { tenantId: profile.id },
  });
  if (billingRecord) {
    const nextChargeDate = calculateNextChargeDate(billingRecord.dayOfMonth);
    await db.recurringBilling.update({
      where: { id: billingRecord.id },
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
      amount: Number(amount),
      kadimaTransactionId: transactionId,
      autopay: true,
    },
    emittedBy: "system",
  }).catch(console.error);
}

/**
 * Handle boarding application webhook events.
 *
 * Key events:
 *   module: "boardingApplication", action: "statusChanged"
 *     → data.status = "New" | "Pending" | "Underwriting" | "Approved" | "Declined" | "Cancelled"
 *     → data.id = boarding application ID
 *
 *   module: "boardingApplication", action: "failedCheck"
 *     → data.boardingApplication.id, data.check.type, data.check.status
 *
 *   module: "boardingApplication", action: "failedAutoApprove"
 *     → data.boardingApplication.id, data.autoApprovalResults.reason
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleBoardingApplicationEvent(event: WebhookEvent) {
  const evtKey = eventKey(event);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = event.data as Record<string, any>;

  if (event.action === "statusChanged") {
    const kadimaAppId = data.id ? String(data.id) : null;
    const newStatus = data.status ? String(data.status) : null;

    if (!kadimaAppId) {
      console.warn(`[Webhook] ${evtKey}: No boarding application ID in event`);
      return;
    }

    console.log(`[Webhook] Boarding app #${kadimaAppId} status changed to: ${newStatus}`);

    const statusMap: Record<string, string> = {
      "New": "IN_PROGRESS",
      "Pending": "SUBMITTED",
      "Underwriting": "SUBMITTED",
      "Approved": "APPROVED",
      "Declined": "REJECTED",
      "Cancelled": "REJECTED",
    };

    const mappedStatus = newStatus ? (statusMap[newStatus] || null) : null;

    if (mappedStatus) {
      const updated = await db.merchantApplication.updateMany({
        where: { kadimaAppId: kadimaAppId },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { status: mappedStatus as any },
      });

      if (updated.count > 0) {
        console.log(`[Webhook] Updated ${updated.count} merchant application(s) to ${mappedStatus}`);

        if (mappedStatus === "APPROVED") {
          const app = await db.merchantApplication.findFirst({
            where: { kadimaAppId: kadimaAppId },
            select: { userId: true },
          });
          if (app) {
            await db.user.update({
              where: { id: app.userId },
              data: { managerStatus: "ACTIVE", suspendedAt: null },
            });
            console.log(`[Webhook] PM ${app.userId} activated after Kadima approval`);

            // Sync terminals from Kadima after approval
            try {
              const { getMerchantCredentials } = await import("@/lib/kadima/merchant-context");
              const { syncTerminalsForPm } = await import("@/lib/kadima/terminal-sync");
              const creds = await getMerchantCredentials(app.userId);
              const syncResult = await syncTerminalsForPm(app.userId, creds);
              console.log(`[Webhook] Terminal sync for PM ${app.userId}:`, syncResult);
            } catch (termErr) {
              console.error(`[Webhook] Terminal sync failed for PM ${app.userId}:`, termErr);
              // Non-fatal — terminal can be manually assigned later
            }
          }
        }

        if (mappedStatus === "REJECTED") {
          const app = await db.merchantApplication.findFirst({
            where: { kadimaAppId: kadimaAppId },
            select: { userId: true, user: { select: { name: true, email: true } } },
          });
          if (app) {
            notify({
              userId: app.userId,
              createdById: app.userId,
              type: "SYSTEM",
              title: "Merchant Application Update",
              message: `Your merchant application has been ${newStatus?.toLowerCase()}. Please contact support for more information.`,
              severity: "urgent",
            }).catch(console.error);
          }
        }
      } else {
        console.warn(`[Webhook] No merchant application found for Kadima app #${kadimaAppId}`);
      }
    }

    auditLog({
      action: "UPDATE",
      objectType: "MerchantApplication",
      objectId: kadimaAppId,
      description: `Kadima boarding status changed to ${newStatus} (${evtKey})`,
      newValue: { kadimaStatus: newStatus, mappedStatus },
    });

  } else if (event.action === "failedCheck") {
    const appId = data.boardingApplication?.id ? String(data.boardingApplication.id) : null;
    const checkType = data.check?.type || "unknown";
    const checkStatus = data.check?.status || "unknown";
    console.warn(`[Webhook] Boarding app #${appId} failed check: ${checkType} = ${checkStatus}`);

    auditLog({
      action: "UPDATE",
      objectType: "MerchantApplication",
      objectId: appId || "unknown",
      description: `Kadima boarding check failed: ${checkType} = ${checkStatus}`,
      newValue: { checkType, checkStatus },
    });

  } else if (event.action === "failedAutoApprove") {
    const appId = data.boardingApplication?.id ? String(data.boardingApplication.id) : null;
    const reason = data.autoApprovalResults?.reason || "unknown";
    console.warn(`[Webhook] Boarding app #${appId} failed auto-approve: ${reason}`);

    auditLog({
      action: "UPDATE",
      objectType: "MerchantApplication",
      objectId: appId || "unknown",
      description: `Kadima auto-approve failed: ${reason}`,
      newValue: { reason },
    });

  } else {
    console.log(`[Webhook] Boarding event ${evtKey} — logged but no action taken`);
  }
}

/**
 * Handle chargeback webhook events.
 *
 * Events:
 *   module: "chargeback", action: "create"
 *   module: "chargeback", action: "update"
 *
 * Chargeback data structure (per Kadima docs):
 *   data.id — chargeback case ID
 *   data.amount — chargeback amount
 *   data.type — "Chargeback" | "Retrieval"
 *   data.status — "Processed" | "Won" | "Lost"
 *   data.attention — "Yes" | "No" (requires merchant attention)
 *   data.gateway.id — gateway transaction ID
 *   data.transaction.number — original transaction payment ID
 *   data.transaction.amount — original transaction amount
 *   data.dba.id — DBA ID
 */
async function handleChargebackEvent(event: WebhookEvent) {
  const evtKey = eventKey(event);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = event.data as Record<string, any>;

  const chargebackId = data.id ? String(data.id) : null;
  const chargebackAmount = data.amount != null ? Number(data.amount) : null;
  const chargebackType = data.type ? String(data.type) : null;
  const chargebackStatus = data.status ? String(data.status) : null;
  const requiresAttention = data.attention === "Yes";
  const gatewayTransactionId = data.gateway?.id ? String(data.gateway.id) : null;
  const originalTransactionId = data.transaction?.number ? String(data.transaction.number) : null;

  console.log(`[Webhook] Chargeback ${evtKey}:`, {
    chargebackId,
    chargebackType,
    chargebackStatus,
    chargebackAmount,
    requiresAttention,
    gatewayTransactionId,
    originalTransactionId,
  });

  const transactionIdToSearch = gatewayTransactionId || originalTransactionId;
  let payment = null;
  if (transactionIdToSearch) {
    payment = await db.payment.findFirst({
      where: { kadimaTransactionId: transactionIdToSearch },
      include: {
        landlord: { select: { id: true, name: true, email: true } },
        tenant: { include: { user: { select: { id: true, name: true } } } },
        unit: { include: { property: { select: { name: true } } } },
      },
    });
  }

  auditLog({
    action: event.action === "create" ? "CREATE" : "UPDATE",
    objectType: "Chargeback",
    objectId: chargebackId || "unknown",
    description: `Chargeback ${event.action}: ${chargebackType} — ${chargebackStatus} — $${chargebackAmount}`,
    newValue: {
      chargebackId,
      chargebackType,
      chargebackStatus,
      chargebackAmount,
      requiresAttention,
      gatewayTransactionId,
      originalTransactionId,
      paymentId: payment?.id || null,
    },
  });

  if (payment?.landlord) {
    const pm = payment.landlord;
    const amt = chargebackAmount != null
      ? formatCurrency(chargebackAmount)
      : "unknown amount";
    const propertyName = payment.unit?.property?.name || "a property";
    const tenantName = payment.tenant?.user?.name || "a tenant";
    const severity = requiresAttention ? "urgent" : "warning";
    const actionRequired = requiresAttention
      ? " Action is required — check your Kadima dashboard."
      : "";

    notify({
      userId: pm.id,
      createdById: pm.id,
      type: "SYSTEM",
      title: chargebackType === "Retrieval" ? "Retrieval Request Received" : "Chargeback Received",
      message: `A ${chargebackType?.toLowerCase() || "chargeback"} of ${amt} has been filed for a payment from ${tenantName} at ${propertyName}.${actionRequired}`,
      severity,
      amount: chargebackAmount != null ? Number(chargebackAmount) : undefined,
    }).catch(console.error);
  } else if (transactionIdToSearch) {
    console.warn(`[Webhook] Chargeback for transaction ${transactionIdToSearch} — no matching payment found in DoorStax`);
  }
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

  // Parse body first — we need id/module/action/date for signature verification
  let event: WebhookEvent;
  try {
    event = parseWebhookEvent(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ─── Signature verification ─────────────────────────────────
  // Kadima sends signature in the "Webhook-Signature" header
  const signature = req.headers.get("webhook-signature") || "";
  const sigResult = await verifyWebhookSignatureMultiMerchant(
    { id: event.id, module: event.module, action: event.action, date: event.date },
    signature
  );
  if (!sigResult.valid) {
    console.warn("[Webhook] Invalid signature for event:", {
      id: event.id,
      module: event.module,
      action: event.action,
      signatureProvided: !!signature,
    });
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 401 }
    );
  }

  try {
    const evtKey = eventKey(event);
    console.log(`[Webhook] Received ${evtKey} from ${sigResult.source} tier`, {
      webhookEventId: event.id,
      date: event.date,
      ...(sigResult.pmUserId ? { pmUserId: sigResult.pmUserId } : {}),
    });

    // ─── Idempotency Guard ─────────────────────────────────────
    // Use the webhook event ID (top-level `id`) for dedup — it's unique per event
    const eventId = `${event.id}:${evtKey}`;
    const payload = JSON.parse(rawBody);

    // Try to create the WebhookEvent record (unique on eventId)
    try {
      await db.webhookEvent.create({
        data: { eventId, eventType: evtKey, payload, status: "RECEIVED" },
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
      // Kadima events use module + action + status to determine what happened.
      //
      // Card transactions:
      //   module: "transaction", action: "create"
      //   → Check data.transaction.status: "Approved" → completed, "Decline"/"Error" → failed
      //   → Check data.transaction.type: "refund" → refunded
      //
      // ACH transactions:
      //   module: "ach", action: "create" → new ACH (check status)
      //   module: "ach", action: "updateStatus" → status change (Approved, Returned, etc.)
      //
      // Recurring:
      //   Recurring charges come through as regular transaction.create events
      //   with recurring-related data. We check if the payment is linked to a recurring billing.

      const { status: kadimaStatus } = extractTransactionInfo(event);
      const mappedStatus = mapKadimaStatus(kadimaStatus);

      // ─── Boarding Application Events ────────────────────────
      if (event.module === "boardingApplication") {
        await handleBoardingApplicationEvent(event);
        await db.webhookEvent.update({
          where: { eventId },
          data: { status: "PROCESSED", processedAt: new Date() },
        });
        return NextResponse.json({ received: true });
      }

      // ─── Chargeback Events ──────────────────────────────────
      if (event.module === "chargeback") {
        await handleChargebackEvent(event);
        await db.webhookEvent.update({
          where: { eventId },
          data: { status: "PROCESSED", processedAt: new Date() },
        });
        return NextResponse.json({ received: true });
      }

      if (event.module === "transaction" && event.action === "create") {
        // Card transaction
        const txnType = event.data.transaction?.type
          ? String(event.data.transaction.type).toLowerCase()
          : "sale";

        if (txnType === "refund") {
          await handleRefunded(event);
        } else if (mappedStatus === "COMPLETED") {
          await handleCompleted(event);
        } else if (mappedStatus === "FAILED") {
          await handleFailed(event);
        } else {
          // Pending or unknown — log and skip
          console.log(`[Webhook] Unhandled card status: ${kadimaStatus} for ${evtKey}`);
        }
      } else if (event.module === "ach") {
        if (event.action === "create" || event.action === "updateStatus") {
          const achStatus = kadimaStatus?.toLowerCase() || "";
          if (achStatus === "returned") {
            await handleRefunded(event);
          } else if (mappedStatus === "COMPLETED") {
            await handleCompleted(event);
          } else if (mappedStatus === "FAILED") {
            await handleFailed(event);
          } else {
            console.log(`[Webhook] Unhandled ACH status: ${kadimaStatus} for ${evtKey}`);
          }
        } else {
          console.log(`[Webhook] Unhandled ACH action: ${event.action}`);
        }
      } else {
        // Unhandled module — mark as processed (nothing to do)
        console.log(`[Webhook] Unhandled event: ${evtKey}`);
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

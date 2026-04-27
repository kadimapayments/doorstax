import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMerchantCredentialsForTenant } from "@/lib/kadima/merchant-context";
import { merchantCreateSaleFromVault } from "@/lib/kadima/merchant-gateway";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "TENANT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { paymentMethod } = body as { paymentMethod: "card" | "ach" };

  // Find the existing pending payment
  const profile = await db.tenantProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      kadimaCustomerId: true,
      kadimaCardTokenId: true,
      kadimaAccountId: true,
      unit: {
        select: {
          id: true,
          property: { select: { kadimaTerminalId: true, landlordId: true } },
        },
      },
    },
  });

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const payment = await db.payment.findFirst({
    where: {
      id,
      tenantId: profile.id,
      status: { in: ["PENDING", "FAILED"] },
    },
  });

  if (!payment) {
    return NextResponse.json({ error: "Charge not found or already paid" }, { status: 404 });
  }

  const chargeAmount = Number(payment.amount);
  let surchargeAmount = 0;

  if (paymentMethod === "card") {
    surchargeAmount = Math.round(chargeAmount * 0.0325 * 100) / 100;
  }

  const totalAmount = chargeAmount + surchargeAmount;

  // Resolve terminal
  const terminalId = profile.unit?.property?.kadimaTerminalId || process.env.KADIMA_TERMINAL_ID;
  if (!terminalId) {
    return NextResponse.json({ error: "No terminal configured" }, { status: 400 });
  }

  console.log("[outstanding-charge] Attempting payment:", {
    paymentId: id,
    paymentMethod,
    chargeAmount,
    totalAmount,
    terminalId,
    cardToken: profile.kadimaCardTokenId ? profile.kadimaCardTokenId.slice(0, 6) + "..." : null,
    accountId: profile.kadimaAccountId,
    customerId: profile.kadimaCustomerId,
    description: payment.description,
    type: payment.type,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let kadimaResult: any = null;

  try {
    if (paymentMethod === "card" && profile.kadimaCardTokenId) {
      const merchantCreds = await getMerchantCredentialsForTenant(profile.id);
      kadimaResult = await merchantCreateSaleFromVault(merchantCreds, {
        cardToken: profile.kadimaCardTokenId,
        amount: totalAmount,
        terminalIdOverride: profile.unit?.property?.kadimaTerminalId || undefined,
      });
    } else if (
      paymentMethod === "ach" &&
      profile.kadimaAccountId &&
      profile.kadimaCustomerId
    ) {
      // Tenant clicked Pay against an outstanding charge in the web
      // portal using a vaulted account → SEC code WEB. Required by
      // Kadima from 2026-05-05.
      //
      // History — two failed attempts before this one:
      //   1) Hand-rolled vaultClient.post("/ach", { dba, account })
      //      omitted `customer.id` → 422 "customer.id cannot be blank".
      //   2) Switched to merchantCreateAchDebit (PM merchant context).
      //      That helper omits the `dba` field, so → 422 "Invalid DBA ID".
      //
      // Correct shape (matches lib/kadima/ach.ts:createAchFromVault):
      //   - Use the platform vaultClient. DoorStax customers and
      //     accounts are vaulted under the PLATFORM DBA via
      //     createCustomer() in customer-vault.ts; the per-PM merchant
      //     API key cannot reach them.
      //   - Body MUST include all three: dba.id (from KADIMA_DBA_ID),
      //     customer.id, and account.id.
      const { createAchFromVault } = await import("@/lib/kadima/ach");
      const { pickSecCode } = await import("@/lib/kadima/sec-code");
      const secCode = pickSecCode({ kind: "tenant_web_vault" });
      kadimaResult = await createAchFromVault({
        customerId: profile.kadimaCustomerId,
        accountId: profile.kadimaAccountId,
        amount: totalAmount,
        secCode,
        memo: payment.description || "Fee payment",
      });
    } else {
      return NextResponse.json(
        {
          error:
            paymentMethod === "ach"
              ? "No saved bank account on file. Add one in the portal first."
              : "No saved payment method",
        },
        { status: 400 }
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error("[outstanding-charge] Payment failed:", {
      message: err?.message,
      status: err?.response?.status,
      data: JSON.stringify(err?.response?.data),
      paymentId: id,
    });

    await db.payment.update({
      where: { id },
      data: {
        status: "FAILED",
        kadimaStatus: "gateway_error",
        declineReasonCode: err?.response?.data?.message || err?.message || "Payment failed",
      },
    });

    return NextResponse.json({ error: "Payment failed" }, { status: 502 });
  }

  // Parse Kadima response (raw object, not wrapped)
  const txn = kadimaResult?.data || kadimaResult;
  const transactionId = txn?.id ? String(txn.id) : null;
  const kadimaStatus = txn?.status?.status || txn?.status || null;
  const cardLast4 = txn?.card?.number ? String(txn.card.number) : (txn?.lastFour ? String(txn.lastFour) : null);
  const achLast4 = txn?.accountNumber ? String(txn.accountNumber).slice(-4) : null;

  // Update the EXISTING payment record (not create a new one)
  await db.payment.update({
    where: { id },
    data: {
      status: "COMPLETED",
      paymentMethod,
      kadimaTransactionId: transactionId,
      kadimaStatus: typeof kadimaStatus === "string" ? kadimaStatus : JSON.stringify(kadimaStatus),
      paidAt: new Date(),
      surchargeAmount: surchargeAmount > 0 ? surchargeAmount : null,
      ...(cardLast4 && { cardLast4 }),
      ...(achLast4 && { achLast4 }),
      // Record SEC code for ACH transactions (null for cards).
      ...(paymentMethod === "ach" && { achSecCode: "WEB" }),
    },
  });

  // Also update the linked expense if one exists
  await db.expense.updateMany({
    where: { paymentId: id },
    data: { status: "PAID", paidAt: new Date() },
  });

  // Create PAYMENT ledger entry to reduce balance
  try {
    const { periodKeyFromDate } = await import("@/lib/ledger");
    const lastEntry = await db.ledgerEntry.findFirst({
      where: { tenantId: payment.tenantId },
      orderBy: { createdAt: "desc" },
      select: { balanceAfter: true },
    });
    const prevBalance = lastEntry ? Number(lastEntry.balanceAfter) : 0;

    await db.ledgerEntry.create({
      data: {
        tenantId: payment.tenantId,
        unitId: payment.unitId,
        type: "PAYMENT",
        amount: -chargeAmount,
        balanceAfter: prevBalance - chargeAmount,
        periodKey: periodKeyFromDate(new Date()),
        description: `Payment: ${payment.description || "Fee payment"}`,
        paymentId: payment.id,
        createdById: profile.id,
      },
    });
  } catch (ledgerErr) {
    console.error("[outstanding-charge] Ledger payment entry failed:", ledgerErr);
  }

  // Accounting journal — credit the right Revenue account (4000 Rent,
  // 4100 Late Fee, 4500 Pet Fee, 4600 Parking, etc.) so tenant-paid
  // outstanding charges show up on the chart of accounts. Idempotent
  // via journalIncomingPayment's dedup guard.
  try {
    const landlordIdForJournal = profile.unit?.property?.landlordId;
    if (landlordIdForJournal) {
      const { seedDefaultAccounts } = await import(
        "@/lib/accounting/chart-of-accounts"
      );
      await seedDefaultAccounts(landlordIdForJournal);
      const { journalIncomingPayment } = await import(
        "@/lib/accounting/auto-entries"
      );
      journalIncomingPayment(payment.id).catch((e) =>
        console.error("[outstanding-charge] Journal entry failed:", e)
      );
    }
  } catch (e) {
    console.error("[outstanding-charge] Journal trigger failed:", e);
  }

  // Notify PM of payment received
  const landlordId = profile.unit?.property?.landlordId;
  if (landlordId) {
    try {
      const { notify } = await import("@/lib/notifications");
      const tenantUser = await db.user.findUnique({ where: { id: session.user.id }, select: { name: true } });
      notify({
        userId: landlordId,
        createdById: session.user.id,
        type: "PAYMENT_RECEIVED",
        title: "Payment Received",
        message: `${tenantUser?.name || "A tenant"} paid $${chargeAmount.toFixed(2)} for ${payment.description || "a charge"}.`,
        severity: "info",
        amount: chargeAmount,
        actionUrl: "/dashboard/payments",
      }).catch(console.error);
    } catch { /* non-blocking */ }
  }

  // Auto-dismiss related charge notifications for this tenant
  try {
    await db.dashboardNotice.updateMany({
      where: {
        targetUserId: session.user.id,
        readAt: null,
        OR: [
          { type: "EXPENSE_INVOICE" },
          { title: { contains: "New Charge" } },
        ],
      },
      data: { readAt: new Date() },
    });
  } catch {
    // Non-blocking
  }

  return NextResponse.json({
    success: true,
    paymentId: id,
    transactionId,
    amount: totalAmount,
  });
}

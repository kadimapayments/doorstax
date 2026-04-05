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
    } else if (paymentMethod === "ach" && profile.kadimaAccountId) {
      const { vaultClient, withRetry } = await import("@/lib/kadima/client");
      const dbaId = process.env.KADIMA_DBA_ID;
      kadimaResult = await withRetry(async () => {
        const { data } = await vaultClient.post("/ach", {
          amount: totalAmount,
          transactionType: "Debit",
          dba: { id: Number(dbaId) },
          account: { id: Number(profile.kadimaAccountId) },
          memo: payment.description || "Fee payment",
        });
        return data;
      });
    } else {
      return NextResponse.json({ error: "No saved payment method" }, { status: 400 });
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
    },
  });

  // Also update the linked expense if one exists
  await db.expense.updateMany({
    where: { paymentId: id },
    data: { status: "PAID", paidAt: new Date() },
  });

  return NextResponse.json({
    success: true,
    paymentId: id,
    transactionId,
    amount: totalAmount,
  });
}

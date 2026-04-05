import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTransaction } from "@/lib/kadima/gateway";
import { getAchTransaction } from "@/lib/kadima/ach";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const payment = await db.payment.findUnique({
    where: { id },
    include: {
      tenant: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      unit: {
        include: {
          property: {
            select: {
              name: true,
              address: true,
              city: true,
              state: true,
              zip: true,
            },
          },
        },
      },
      landlord: { select: { name: true, email: true } },
    },
  });

  if (!payment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Authorization: ADMIN can see any, LANDLORD sees own, TENANT sees own
  const { role } = session.user;
  if (role === "PM" && payment.landlordId !== session.user.id) {
    // Check if they're a team member of this landlord
    const team = await db.teamMember.findFirst({
      where: { userId: session.user.id, isActive: true },
      select: { landlordId: true },
    });
    if (!team || team.landlordId !== payment.landlordId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  if (role === "TENANT" && payment.tenant.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch gateway details from Kadima if transaction ID exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let gatewayDetails: Record<string, unknown> | null = null;
  if (payment.kadimaTransactionId) {
    try {
      if (payment.paymentMethod === "card") {
        // Gateway returns raw transaction object (not wrapped)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const txn = await getTransaction(payment.kadimaTransactionId) as any;
        if (txn && txn.id) {
          gatewayDetails = {
            authCode: txn.authCode || null,
            avsResponse: txn.card?.verification?.address || null,
            cvvResponse: txn.card?.verification?.cvv || null,
            cardholderName: txn.card?.name || null,
            networkTransactionId: txn.card?.networkTransactionId || null,
            referenceNumber: String(txn.id),
            responseCode: txn.status?.status || null,
            responseText: txn.status?.reason || null,
            entryMode: txn.origin || "API",
            captured: txn.captured ?? null,
            refunded: txn.refunded ?? null,
            batchId: txn.batch?.id || null,
            type: txn.type || null,
            level: txn.level || null,
            createdOn: txn.createdOn || null,
            updatedOn: txn.updatedOn || null,
            history: txn.history || [],
          };
        }
      } else if (payment.paymentMethod === "ach") {
        // ACH returns raw object too
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const txn = await getAchTransaction(payment.kadimaTransactionId) as any;
        if (txn && (txn.id || txn.data?.id)) {
          const d = txn.data || txn;
          gatewayDetails = {
            secCode: d.secCode || null,
            effectiveDate: d.effectiveDate || null,
            traceNumber: d.traceNumber || null,
            batchNumber: d.batchNumber || null,
            accountType: d.accountType || null,
            routingNumber: d.routingNumber || null,
            accountNumber: d.accountNumber || null,
            returnCode: d.returnCode || null,
            returnReason: d.returnReason || null,
            status: d.status || null,
            createdAt: d.createdAt || d.createdOn || null,
          };
        }
      }
    } catch {
      // Kadima lookup failed — return payment without gateway details
    }
  }

  // Serialize Decimal fields
  return NextResponse.json({
    ...payment,
    amount: Number(payment.amount),
    surchargeAmount: payment.surchargeAmount ? Number(payment.surchargeAmount) : null,
    landlordFee: payment.landlordFee ? Number(payment.landlordFee) : null,
    gatewayDetails,
  });
}

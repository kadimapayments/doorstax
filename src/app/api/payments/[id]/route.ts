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
  let gatewayDetails = null;
  if (payment.kadimaTransactionId) {
    try {
      if (payment.paymentMethod === "card") {
        const txn = await getTransaction(payment.kadimaTransactionId);
        if (txn.success && txn.data) {
          gatewayDetails = txn.data;
        }
      } else if (payment.paymentMethod === "ach") {
        const txn = await getAchTransaction(payment.kadimaTransactionId);
        if (txn.success && txn.data) {
          gatewayDetails = txn.data;
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

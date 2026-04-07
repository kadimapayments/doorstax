import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { auditLog } from "@/lib/audit";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !["PM", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const landlordId = await getEffectiveLandlordId(session.user.id);
  const body = await req.json().catch(() => ({}));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reason = (body as any).reason || "Voided by PM";

  const payment = await db.payment.findFirst({
    where: { id, landlordId, status: { in: ["PENDING", "FAILED"] } },
  });

  if (!payment) {
    return NextResponse.json({ error: "Payment not found or already processed" }, { status: 404 });
  }

  await db.payment.update({
    where: { id },
    data: {
      status: "REFUNDED",
      kadimaStatus: "voided",
      declineReasonCode: reason,
    },
  });

  auditLog({
    userId: session.user.id,
    userName: session.user.name,
    userRole: session.user.role,
    action: "VOID",
    objectType: "Payment",
    objectId: id,
    description: `Voided payment: ${reason} ($${Number(payment.amount).toFixed(2)})`,
    req,
  });

  return NextResponse.json({ success: true });
}

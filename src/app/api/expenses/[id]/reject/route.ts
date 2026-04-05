import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { auditLog } from "@/lib/audit";

/**
 * POST /api/expenses/:id/reject
 * Reject a pending expense with an optional reason. Only PM/ADMIN can reject.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !["PM", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { reason } = body as { reason?: string };
  const landlordId = await getEffectiveLandlordId(session.user.id);

  const expense = await db.expense.findFirst({
    where: { id, landlordId },
  });

  if (!expense) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  const updated = await db.expense.update({
    where: { id },
    data: {
      status: "WRITTEN_OFF",
      notes: reason ? `Rejected: ${reason}` : "Rejected",
    },
  });

  auditLog({
    userId: session.user.id,
    userName: session.user.name,
    userRole: session.user.role,
    action: "REJECT",
    objectType: "Expense",
    objectId: id,
    description: `Rejected expense: ${expense.description} ($${Number(expense.amount).toFixed(2)})${reason ? " — " + reason : ""}`,
    req,
  });

  return NextResponse.json({
    ...updated,
    amount: Number(updated.amount),
  });
}

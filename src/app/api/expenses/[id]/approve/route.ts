import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { auditLog } from "@/lib/audit";

/**
 * POST /api/expenses/:id/approve
 * Approve a pending expense. Only PM/ADMIN can approve.
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
  const landlordId = await getEffectiveLandlordId(session.user.id);

  const expense = await db.expense.findFirst({
    where: { id, landlordId },
  });

  if (!expense) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  if (expense.status !== "PENDING") {
    return NextResponse.json({ error: "Only pending expenses can be approved" }, { status: 400 });
  }

  const updated = await db.expense.update({
    where: { id },
    data: {
      status: "APPROVED",
      approvedBy: session.user.id,
      approvedAt: new Date(),
    },
  });

  auditLog({
    userId: session.user.id,
    userName: session.user.name,
    userRole: session.user.role,
    action: "APPROVE",
    objectType: "Expense",
    objectId: id,
    description: `Approved expense: ${expense.description} ($${Number(expense.amount).toFixed(2)})`,
    req,
  });

  return NextResponse.json({
    ...updated,
    amount: Number(updated.amount),
  });
}

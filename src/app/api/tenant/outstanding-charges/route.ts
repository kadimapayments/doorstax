import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/tenant/outstanding-charges
 * Returns all unpaid charges for the current tenant (fees, deposits, applications).
 * Excludes regular RENT type payments — those are handled by the rent flow.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "TENANT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await db.tenantProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Fetch pending/unpaid charges that are NOT rent
  const charges = await db.payment.findMany({
    where: {
      tenantId: profile.id,
      status: { in: ["PENDING", "FAILED"] },
      type: { in: ["FEE", "DEPOSIT", "APPLICATION"] },
    },
    select: {
      id: true,
      amount: true,
      type: true,
      status: true,
      description: true,
      dueDate: true,
      createdAt: true,
    },
    orderBy: { dueDate: "asc" },
  });

  const now = new Date();
  return NextResponse.json(
    charges.map((c) => ({
      id: c.id,
      amount: Number(c.amount),
      type: c.type,
      status: c.status,
      description: c.description || "Charge",
      dueDate: c.dueDate.toISOString(),
      createdAt: c.createdAt.toISOString(),
      isOverdue: c.dueDate < now && c.status === "PENDING",
    }))
  );
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owner = await db.owner.findFirst({ where: { userId: session.user.id } });
  if (!owner) return NextResponse.json({ error: "Owner profile not found" }, { status: 404 });

  const payouts = await db.ownerPayout.findMany({
    where: { ownerId: owner.id },
    orderBy: { periodStart: "desc" },
  });

  return NextResponse.json(
    payouts.map((p) => ({
      id: p.id,
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      grossRent: Number(p.grossRent),
      processingFees: Number(p.processingFees),
      managementFee: Number(p.managementFee),
      expenses: Number(p.expenses),
      platformFee: Number(p.platformFee),
      payoutFee: Number(p.payoutFee),
      unitFee: Number(p.unitFee),
      netPayout: Number(p.netPayout),
      status: p.status,
      paidAt: p.paidAt,
      notes: p.notes,
    }))
  );
}

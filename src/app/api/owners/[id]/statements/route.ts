import { NextResponse } from "next/server";
import { resolveApiSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await resolveApiSession();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const landlordId = await getEffectiveLandlordId(session.user.id);
  const { id } = await params;

  const owner = await db.owner.findFirst({
    where: { id, landlordId },
    select: { id: true, name: true },
  });
  if (!owner) {
    return NextResponse.json({ error: "Owner not found" }, { status: 404 });
  }

  // Fetch all payouts as statement line items
  const payouts = await db.ownerPayout.findMany({
    where: { ownerId: id },
    orderBy: { periodStart: "desc" },
  });

  const statements = payouts.map((p) => ({
    id: p.id,
    period: `${new Date(p.periodStart).toLocaleDateString("en-US", { month: "long", year: "numeric" })}`,
    periodStart: p.periodStart,
    periodEnd: p.periodEnd,
    grossRent: Number(p.grossRent),
    processingFees: Number(p.processingFees),
    managementFee: Number(p.managementFee),
    expenses: Number(p.expenses),
    payoutFee: Number(p.payoutFee),
    unitFee: Number(p.unitFee),
    netPayout: Number(p.netPayout),
    status: p.status,
    paidAt: p.paidAt,
  }));

  return NextResponse.json({ owner, statements });
}

import { NextResponse } from "next/server";
import { resolveApiSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { generatePayout, serializePayout } from "@/lib/payout-generator";

export async function GET(req: Request) {
  const session = await resolveApiSession();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);
  const { searchParams } = new URL(req.url);
  const ownerId = searchParams.get("ownerId");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = { landlordId };
  if (ownerId) where.ownerId = ownerId;
  if (status) where.status = status;

  try {
    const payouts = await db.ownerPayout.findMany({
      where,
      include: {
        owner: {
          select: {
            id: true, name: true, email: true, terminalId: true, achTerminalId: true,
            properties: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { periodStart: "desc" },
    });

    return NextResponse.json(payouts.map(serializePayout));
  } catch {
    return NextResponse.json({ error: "Failed to fetch payouts" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await resolveApiSession();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);

  try {
    const body = await req.json();
    const { ownerId, month, year, half } = body;

    if (!ownerId || !month || !year) {
      return NextResponse.json({ error: "ownerId, month, and year are required" }, { status: 400 });
    }

    // Verify owner belongs to this PM
    const owner = await db.owner.findFirst({
      where: { id: ownerId, landlordId },
      include: { properties: { select: { id: true } } },
      // Fetch new fields needed for fee calculations
    });
    if (!owner) {
      return NextResponse.json({ error: "Owner not found" }, { status: 404 });
    }
    if (!owner.properties.length) {
      return NextResponse.json({ error: "Owner has no assigned properties" }, { status: 400 });
    }

    const frequency = owner.payoutFrequency || "MONTHLY";

    if (frequency === "SEMI_MONTHLY") {
      // Generate one or both halves
      const halves = half ? [half] : [1, 2];
      const results = [];
      for (const h of halves) {
        const result = await generatePayout(owner, landlordId, month, year, h);
        if (result) results.push(result);
      }
      if (results.length === 0) {
        return NextResponse.json({ error: "Payout already exists for this period" }, { status: 400 });
      }
      return NextResponse.json(results.length === 1 ? results[0] : results, { status: 201 });
    } else {
      // MONTHLY - same logic but with new fee calculations
      const result = await generatePayout(owner, landlordId, month, year, null);
      if (!result) {
        return NextResponse.json({ error: "Payout already exists for this period" }, { status: 400 });
      }
      return NextResponse.json(result, { status: 201 });
    }
  } catch (e) {
    console.error("Payout generation error:", e);
    return NextResponse.json({ error: "Failed to generate payout" }, { status: 500 });
  }
}

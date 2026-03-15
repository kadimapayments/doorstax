import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createSubscription, calculateMonthlyPrice } from "@/lib/subscription";

// GET: current subscription info
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await db.subscription.findUnique({
    where: { userId: session.user.id },
    include: {
      payments: { orderBy: { paidAt: "desc" }, take: 12 },
    },
  });

  if (!sub) {
    // Return info suggesting subscription creation
    const unitCount = await db.unit.count({
      where: { property: { landlordId: session.user.id } },
    });
    return NextResponse.json({
      active: false,
      estimatedPrice: calculateMonthlyPrice(unitCount),
      buildingCount: unitCount,
    });
  }

  return NextResponse.json(sub);
}

// POST: create new subscription (auto-trial)
export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if already exists
  const existing = await db.subscription.findUnique({ where: { userId: session.user.id } });
  if (existing) {
    return NextResponse.json({ error: "Subscription already exists" }, { status: 400 });
  }

  const sub = await createSubscription(session.user.id);
  return NextResponse.json(sub, { status: 201 });
}

// PUT: cancel subscription
export async function PUT() {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await db.subscription.findUnique({ where: { userId: session.user.id } });
  if (!sub) {
    return NextResponse.json({ error: "No subscription found" }, { status: 404 });
  }

  const updated = await db.subscription.update({
    where: { userId: session.user.id },
    data: { status: "CANCELLED" },
  });

  return NextResponse.json(updated);
}

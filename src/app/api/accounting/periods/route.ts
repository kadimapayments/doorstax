export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "PM" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const periods = await db.accountingPeriod.findMany({
      where: { pmId: session.user.id },
      orderBy: { period: "desc" },
    });

    return NextResponse.json(periods);
  } catch (err) {
    console.error("[accounting/periods] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch periods" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "PM" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { period, action } = await req.json();
    if (!period || !action) {
      return NextResponse.json({ error: "period and action required" }, { status: 400 });
    }

    const existing = await db.accountingPeriod.findUnique({
      where: { pmId_period: { pmId: session.user.id, period } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 });
    }

    if (action === "close") {
      await db.accountingPeriod.update({
        where: { id: existing.id },
        data: { status: "CLOSED", closedAt: new Date(), closedById: session.user.id },
      });
    } else if (action === "lock") {
      await db.accountingPeriod.update({
        where: { id: existing.id },
        data: { status: "LOCKED", closedAt: existing.closedAt || new Date(), closedById: session.user.id },
      });
    } else if (action === "reopen") {
      if (existing.status === "LOCKED") {
        return NextResponse.json({ error: "Cannot reopen a locked period" }, { status: 400 });
      }
      await db.accountingPeriod.update({
        where: { id: existing.id },
        data: { status: "OPEN", closedAt: null, closedById: null },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[accounting/periods] POST error:", err);
    return NextResponse.json({ error: "Failed to update period" }, { status: 500 });
  }
}

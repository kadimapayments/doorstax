import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "PM" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get("propertyId");

    const propertyFilter = propertyId
      ? { id: propertyId, landlordId: session.user.id }
      : { landlordId: session.user.id };

    const spaces = await db.parkingSpace.findMany({
      where: {
        lot: { property: propertyFilter, isActive: true },
        isActive: true,
      },
      select: {
        id: true,
        type: true,
        assignments: {
          where: { status: "ACTIVE" },
          select: { isIncluded: true, monthlyCharge: true, expiresAt: true },
        },
      },
    });

    const totalSpaces = spaces.length;
    const assignedSpaces = spaces.filter((s) => s.assignments.length > 0).length;
    const availableSpaces = totalSpaces - assignedSpaces;

    const monthlyRevenue = spaces.reduce((sum, s) => {
      return (
        sum +
        s.assignments.reduce(
          (ss, a) => ss + (a.isIncluded ? 0 : a.monthlyCharge),
          0
        )
      );
    }, 0);

    // Space type breakdown
    const typeBreakdown: Record<string, number> = {};
    for (const s of spaces) {
      typeBreakdown[s.type] = (typeBreakdown[s.type] || 0) + 1;
    }

    // Expiring soon (next 30 days)
    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const expiringSoon = spaces.reduce((count, s) => {
      return (
        count +
        s.assignments.filter(
          (a) => a.expiresAt && a.expiresAt < thirtyDays && a.expiresAt > new Date()
        ).length
      );
    }, 0);

    return NextResponse.json({
      totalSpaces,
      assignedSpaces,
      availableSpaces,
      occupancyRate: totalSpaces > 0 ? assignedSpaces / totalSpaces : 0,
      monthlyRevenue,
      annualizedRevenue: monthlyRevenue * 12,
      typeBreakdown,
      expiringSoon,
    });
  } catch (err) {
    console.error("[parking/stats] error:", err);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}

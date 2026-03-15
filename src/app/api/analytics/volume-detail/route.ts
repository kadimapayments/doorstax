import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") || "pm";

  const now = new Date();
  const reqMonth = searchParams.get("month");
  const reqYear = searchParams.get("year");
  const month = reqMonth ? parseInt(reqMonth, 10) - 1 : now.getMonth(); // 0-indexed
  const year = reqYear ? parseInt(reqYear, 10) : now.getFullYear();

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 1);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereClause: any = {
    createdAt: { gte: monthStart, lt: monthEnd },
  };

  if (scope === "pm") {
    const user = session.user;
    if (user.role !== "PM" && user.role !== "ADMIN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const landlordId = await getEffectiveLandlordId(user.id);
    whereClause.landlordId = landlordId;
  } else if (scope === "owner") {
    const owner = await db.owner.findFirst({
      where: { userId: session.user.id },
    });
    if (!owner)
      return NextResponse.json({ error: "Owner not found" }, { status: 404 });
    const propertyIds = (
      await db.property.findMany({
        where: { ownerId: owner.id },
        select: { id: true },
      })
    ).map((p) => p.id);
    const unitIds = (
      await db.unit.findMany({
        where: { propertyId: { in: propertyIds } },
        select: { id: true },
      })
    ).map((u) => u.id);
    whereClause.unitId = { in: unitIds };
  } else if (scope === "admin") {
    if (session.user.role !== "ADMIN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    // No additional filter — platform-wide
  }

  const payments = await db.payment.findMany({
    where: whereClause,
    select: {
      status: true,
      amount: true,
      paymentMethod: true,
      cardBrand: true,
      createdAt: true,
    },
  });

  // 1. Daily data
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = MONTH_NAMES[month];
  const dailyData = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    return { date: `${monthName.slice(0, 3)} ${day}`, amount: 0, count: 0 };
  });

  for (const p of payments) {
    if (p.status !== "COMPLETED" && p.status !== "REFUNDED") continue;
    const day = p.createdAt.getDate() - 1;
    if (day >= 0 && day < daysInMonth) {
      if (p.status === "COMPLETED") {
        dailyData[day].amount += Number(p.amount);
        dailyData[day].count++;
      }
    }
  }

  // Round amounts
  for (const d of dailyData) {
    d.amount = Math.round(d.amount * 100) / 100;
  }

  // 2. Brand/method breakdown
  const brandKeys = ["visa", "mastercard", "amex", "discover", "ach"];
  const brandDisplayNames: Record<string, string> = {
    visa: "Visa",
    mastercard: "Mastercard",
    amex: "American Express",
    discover: "Discover",
    ach: "ACH / Bank Transfer",
  };

  const brandBreakdown = brandKeys.map((key) => {
    const filtered = payments.filter((p) => {
      if (key === "ach") {
        return (p.paymentMethod || "").toLowerCase() === "ach";
      }
      return (
        (p.paymentMethod || "").toLowerCase() === "card" &&
        (p.cardBrand || "").toLowerCase() === key
      );
    });

    const sales = filtered.filter((p) => p.status === "COMPLETED");
    const credits = filtered.filter((p) => p.status === "REFUNDED");

    const salesCount = sales.length;
    const salesVolume = sales.reduce((s, p) => s + Number(p.amount), 0);
    const avgTicket = salesCount > 0 ? salesVolume / salesCount : 0;
    const creditsCount = credits.length;
    const creditsVolume = credits.reduce((s, p) => s + Number(p.amount), 0);

    return {
      brand: brandDisplayNames[key],
      brandKey: key,
      salesCount,
      salesVolume: Math.round(salesVolume * 100) / 100,
      avgTicket: Math.round(avgTicket * 100) / 100,
      creditsCount,
      creditsVolume: Math.round(creditsVolume * 100) / 100,
    };
  });

  // Totals
  const allSales = payments.filter((p) => p.status === "COMPLETED");
  const allCredits = payments.filter((p) => p.status === "REFUNDED");
  const totalSalesCount = allSales.length;
  const totalSalesVolume = allSales.reduce((s, p) => s + Number(p.amount), 0);
  const totalCreditsCount = allCredits.length;
  const totalCreditsVolume = allCredits.reduce((s, p) => s + Number(p.amount), 0);

  const totals = {
    salesCount: totalSalesCount,
    salesVolume: Math.round(totalSalesVolume * 100) / 100,
    avgTicket: totalSalesCount > 0 ? Math.round((totalSalesVolume / totalSalesCount) * 100) / 100 : 0,
    creditsCount: totalCreditsCount,
    creditsVolume: Math.round(totalCreditsVolume * 100) / 100,
  };

  return NextResponse.json({
    dailyData,
    brandBreakdown,
    totals,
    month: month + 1, // 1-indexed for UI
    year,
    monthLabel: `${monthName} ${year}`,
  });
}

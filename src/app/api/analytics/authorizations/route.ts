import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";

function mapDeclineReason(code: string | null | undefined): string {
  if (!code) return "No reason provided";
  const map: Record<string, string> = {
    insufficient_funds: "Insufficient funds",
    suspected_fraud: "Suspected fraud",
    exceeds_withdrawal_limit: "Exceeds withdrawal frequency limit",
    exceeds_withdrawal_frequency_limit: "Exceeds withdrawal frequency limit",
    do_not_honor: "No reason to decline",
    card_expired: "Card expired",
    invalid_card: "Invalid card",
    lost_card: "Suspected fraud",
    stolen_card: "Suspected fraud",
  };
  return map[code.toLowerCase()] || "Other";
}

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
    paymentMethod: "card",
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
      cardBrand: true,
      declineReasonCode: true,
      createdAt: true,
    },
  });

  // 1. Daily data
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = MONTH_NAMES[month];
  const dailyData = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    return { date: `${monthName.slice(0, 3)} ${day}`, approvals: 0, declines: 0 };
  });

  for (const p of payments) {
    const day = p.createdAt.getDate() - 1;
    if (day >= 0 && day < daysInMonth) {
      if (p.status === "COMPLETED") dailyData[day].approvals++;
      else if (p.status === "FAILED") dailyData[day].declines++;
    }
  }

  // 2. Brand breakdown
  const brands = ["visa", "mastercard", "amex", "discover"];
  const brandBreakdown = brands.map((brand) => {
    const brandPayments = payments.filter(
      (p) => (p.cardBrand || "").toLowerCase() === brand
    );
    const totalAuth = brandPayments.length;
    const totalAmount = brandPayments.reduce(
      (s, p) => s + Number(p.amount),
      0
    );
    const approved = brandPayments.filter((p) => p.status === "COMPLETED");
    const approvalCountRatio =
      totalAuth > 0 ? (approved.length / totalAuth) * 100 : 0;
    const approvedAmount = approved.reduce(
      (s, p) => s + Number(p.amount),
      0
    );
    const approvalAmountRatio =
      totalAmount > 0 ? (approvedAmount / totalAmount) * 100 : 0;

    const displayName =
      brand === "visa"
        ? "Visa"
        : brand === "mastercard"
        ? "Mastercard"
        : brand === "amex"
        ? "American Express"
        : "Discover";

    return {
      brand: displayName,
      brandKey: brand,
      totalAuth,
      totalAmount: Math.round(totalAmount * 100) / 100,
      approvalCountRatio: Math.round(approvalCountRatio * 100) / 100,
      approvalAmountRatio: Math.round(approvalAmountRatio * 100) / 100,
    };
  });

  // Totals row
  const totalAuth = payments.length;
  const totalAmount = payments.reduce((s, p) => s + Number(p.amount), 0);
  const totalApproved = payments.filter((p) => p.status === "COMPLETED");
  const totals = {
    totalAuth,
    totalAmount: Math.round(totalAmount * 100) / 100,
    approvalCountRatio:
      totalAuth > 0
        ? Math.round((totalApproved.length / totalAuth) * 10000) / 100
        : 0,
    approvalAmountRatio:
      totalAmount > 0
        ? Math.round(
            (totalApproved.reduce((s, p) => s + Number(p.amount), 0) /
              totalAmount) *
              10000
          ) / 100
        : 0,
  };

  // 3. Decline reasons
  const reasonMap: Record<string, number> = {};
  const failed = payments.filter((p) => p.status === "FAILED");
  for (const p of failed) {
    const reason = mapDeclineReason(p.declineReasonCode);
    reasonMap[reason] = (reasonMap[reason] || 0) + 1;
  }
  const declineReasons = Object.entries(reasonMap).map(([reason, count]) => ({
    reason,
    count,
  }));

  return NextResponse.json({
    dailyData,
    brandBreakdown,
    declineReasons,
    totals,
    month: month + 1, // 1-indexed for the UI
    year,
    monthLabel: `${monthName} ${year}`,
  });
}

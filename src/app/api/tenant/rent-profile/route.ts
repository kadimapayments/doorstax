import { NextResponse } from "next/server";
import { resolveApiSession } from "@/lib/api-auth";
import { db } from "@/lib/db";

const GRACE_DAYS = 5;

export async function GET() {
  const session = await resolveApiSession();
  if (!session?.user || session.user.role !== "TENANT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await db.tenantProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      user: { select: { name: true, email: true } },
      unit: {
        include: {
          property: { select: { name: true, address: true, city: true, state: true, zip: true } },
        },
      },
    },
  });

  if (!profile || !profile.unit) {
    return NextResponse.json({ error: "No tenant profile" }, { status: 404 });
  }

  // Active lease
  const lease = await db.lease.findFirst({
    where: { tenantId: profile.id, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    select: { startDate: true, endDate: true, rentAmount: true },
  });

  // All payments (up to 36 months)
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 36);

  const payments = await db.payment.findMany({
    where: {
      tenantId: profile.id,
      dueDate: { gte: startDate },
    },
    orderBy: { dueDate: "asc" },
  });

  // ── Scoring ──
  const completed = payments.filter((p) => p.status === "COMPLETED");
  const onTimeCount = completed.filter((p) => {
    if (!p.paidAt) return false;
    const graceDate = new Date(p.dueDate);
    graceDate.setDate(graceDate.getDate() + GRACE_DAYS);
    return p.paidAt <= graceDate;
  }).length;

  const onTimeRate = completed.length > 0
    ? Math.round((onTimeCount / completed.length) * 100)
    : 0;

  const totalPaid = completed.reduce((s, p) => s + Number(p.amount), 0);

  // Average days to pay (completed payments only)
  let avgDaysToPay = 0;
  if (completed.length > 0) {
    const totalDays = completed.reduce((sum, p) => {
      if (!p.paidAt) return sum;
      const diff = Math.max(
        0,
        Math.floor(
          (p.paidAt.getTime() - new Date(p.dueDate).getTime()) / (1000 * 60 * 60 * 24)
        )
      );
      return sum + diff;
    }, 0);
    avgDaysToPay = Math.round(totalDays / completed.length);
  }

  // Consecutive on-time streak (count backward from most recent)
  let consecutiveOnTime = 0;
  const sortedCompleted = [...completed].sort(
    (a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()
  );
  for (const p of sortedCompleted) {
    if (!p.paidAt) break;
    const graceDate = new Date(p.dueDate);
    graceDate.setDate(graceDate.getDate() + GRACE_DAYS);
    if (p.paidAt <= graceDate) {
      consecutiveOnTime++;
    } else {
      break;
    }
  }

  // Consistency
  const missedPayments = payments.filter(
    (p) => p.status === "FAILED" || p.status === "PENDING"
  ).length;

  let consistency: "Excellent" | "Good" | "Fair" | "Poor";
  if (onTimeRate >= 95 && missedPayments === 0) {
    consistency = "Excellent";
  } else if (onTimeRate >= 85 && missedPayments <= 1) {
    consistency = "Good";
  } else if (onTimeRate >= 70) {
    consistency = "Fair";
  } else {
    consistency = "Poor";
  }

  // Risk level
  const failureCount = payments.filter((p) => p.status === "FAILED").length;
  let riskLevel: "Low" | "Medium" | "High";
  if (failureCount >= 3) {
    riskLevel = "High";
  } else if (failureCount >= 2) {
    riskLevel = "Medium";
  } else {
    riskLevel = "Low";
  }

  // Payment score (weighted composite)
  const paymentScore = Math.min(
    100,
    Math.round(onTimeRate * 0.6 + (consistency === "Excellent" ? 30 : consistency === "Good" ? 20 : consistency === "Fair" ? 10 : 0) + (riskLevel === "Low" ? 10 : riskLevel === "Medium" ? 5 : 0))
  );

  // ── Monthly payment chart data ──
  const monthlyMap = new Map<string, { amount: number; onTime: boolean }>();

  for (const p of completed) {
    const d = new Date(p.dueDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-US", { month: "short", year: "numeric" });

    const graceDate = new Date(p.dueDate);
    graceDate.setDate(graceDate.getDate() + GRACE_DAYS);
    const wasOnTime = p.paidAt ? p.paidAt <= graceDate : false;

    const existing = monthlyMap.get(key);
    if (existing) {
      existing.amount += Number(p.amount);
      existing.onTime = existing.onTime && wasOnTime;
    } else {
      monthlyMap.set(key, { amount: Number(p.amount), onTime: wasOnTime });
    }
  }

  const monthlyPayments = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, data]) => {
      const [yr, mo] = key.split("-");
      const d = new Date(Number(yr), Number(mo) - 1);
      return {
        month: d.toLocaleString("en-US", { month: "short", year: "numeric" }),
        amount: Math.round(data.amount * 100) / 100,
        onTime: data.onTime,
      };
    });

  // ── Payment timeline (most recent 24) ──
  const recentPayments = [...payments]
    .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime())
    .slice(0, 24)
    .map((p) => {
      let daysLate = 0;
      if (p.paidAt) {
        const diff = Math.floor(
          (p.paidAt.getTime() - new Date(p.dueDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        daysLate = Math.max(0, diff - GRACE_DAYS);
      }
      return {
        id: p.id,
        dueDate: p.dueDate.toISOString(),
        paidAt: p.paidAt?.toISOString() || null,
        amount: Number(p.amount),
        status: p.status,
        paymentMethod: p.paymentMethod,
        daysLate,
      };
    });

  return NextResponse.json({
    tenant: {
      name: profile.user.name,
      email: profile.user.email,
      unit: profile.unit.unitNumber,
      property: profile.unit.property.name,
      address: `${profile.unit.property.address}, ${profile.unit.property.city}, ${profile.unit.property.state} ${profile.unit.property.zip}`,
      leaseStart: lease?.startDate?.toISOString() || null,
      leaseEnd: lease?.endDate?.toISOString() || null,
      monthlyRent: lease ? Number(lease.rentAmount) : null,
    },
    score: {
      paymentScore,
      onTimeRate,
      consistency,
      riskLevel,
      avgDaysToPay,
      consecutiveOnTime,
      totalPaid,
    },
    monthlyPayments,
    payments: recentPayments,
    summary: {
      totalPayments: payments.length,
      completedPayments: completed.length,
      totalMonths: monthlyPayments.length,
    },
  });
}

import { NextResponse } from "next/server";
import { resolveApiSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";

export async function GET() {
  const session = await resolveApiSession();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);

  // Fetch all properties with units and tenant profiles
  const properties = await db.property.findMany({
    where: { landlordId },
    include: {
      units: {
        include: {
          tenantProfiles: {
            include: { user: { select: { name: true } } },
          },
        },
      },
    },
  });

  // Fetch all payments for this landlord
  const payments = await db.payment.findMany({
    where: { landlordId },
    include: {
      unit: { select: { unitNumber: true, propertyId: true } },
      tenant: { include: { user: { select: { name: true } } } },
    },
  });

  // Calculate metrics
  const allUnits = properties.flatMap((p) => p.units);
  const totalUnits = allUnits.length;
  const occupiedUnits = allUnits.filter((u) => u.status === "OCCUPIED").length;
  const occupancyRate =
    totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

  // Average rent per sqft
  const unitsWithSqft = allUnits.filter((u) => u.sqft && u.sqft > 0);
  const avgRentPerSqft =
    unitsWithSqft.length > 0
      ? unitsWithSqft.reduce(
          (sum, u) => sum + Number(u.rentAmount) / u.sqft!,
          0
        ) / unitsWithSqft.length
      : 0;

  // Payment timeliness (% of completed payments that were on or before due date)
  const completedPayments = payments.filter((p) => p.status === "COMPLETED");
  const onTimePayments = completedPayments.filter(
    (p) => p.paidAt && p.paidAt <= p.dueDate
  );
  const timelinessScore =
    completedPayments.length > 0
      ? Math.round((onTimePayments.length / completedPayments.length) * 100)
      : 100;

  // Average tenant tenure
  const tenantsWithLease = allUnits
    .flatMap((u) => u.tenantProfiles)
    .filter((t) => t.leaseStart);
  const avgTenure =
    tenantsWithLease.length > 0
      ? Math.round(
          tenantsWithLease.reduce((sum, t) => {
            const start = new Date(t.leaseStart!);
            const now = new Date();
            return (
              sum +
              (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30)
            );
          }, 0) / tenantsWithLease.length
        )
      : 0;

  // Portfolio average rent
  const avgRent =
    totalUnits > 0
      ? allUnits.reduce((sum, u) => sum + Number(u.rentAmount), 0) / totalUnits
      : 0;

  // Vacancy revenue loss calculations
  const vacantUnits = totalUnits - occupiedUnits;
  const monthlyVacancyLoss = vacantUnits * avgRent;
  const dailyVacancyLoss = monthlyVacancyLoss / 30;

  // Unit pricing analysis
  const unitAnalysis = allUnits.map((u) => {
    const rent = Number(u.rentAmount);
    const property = properties.find((p) => p.id === u.propertyId);
    const ratio = avgRent > 0 ? rent / avgRent : 1;
    let priceTag: "optimal" | "below" | "above" = "optimal";
    if (ratio < 0.85) priceTag = "below";
    else if (ratio > 1.15) priceTag = "above";

    return {
      unitId: u.id,
      unitNumber: u.unitNumber,
      propertyName: property?.name || "\u2014",
      propertyId: u.propertyId,
      rent,
      sqft: u.sqft,
      status: u.status,
      portfolioAvg: Math.round(avgRent),
      priceTag,
      vacancyLoss: u.status !== "OCCUPIED" ? Math.round(avgRent) : 0,
    };
  });

  // Building performance
  const buildingPerformance = properties
    .map((p) => {
      const units = p.units;
      const totalU = units.length;
      const occupiedU = units.filter((u) => u.status === "OCCUPIED").length;
      const propertyPayments = payments.filter(
        (pay) => pay.unit.propertyId === p.id
      );
      const completedP = propertyPayments.filter(
        (pay) => pay.status === "COMPLETED"
      );
      const onTimeP = completedP.filter(
        (pay) => pay.paidAt && pay.paidAt <= pay.dueDate
      );
      const revenue = completedP.reduce(
        (sum, pay) => sum + Number(pay.amount),
        0
      );
      const avgR =
        totalU > 0
          ? units.reduce((s, u) => s + Number(u.rentAmount), 0) / totalU
          : 0;
      const timeliness =
        completedP.length > 0
          ? Math.round((onTimeP.length / completedP.length) * 100)
          : 100;
      const occupancy =
        totalU > 0 ? Math.round((occupiedU / totalU) * 100) : 0;
      // Composite score: weighted average of occupancy (40%), timeliness (40%), revenue normalized (20%)
      const score =
        occupancy * 0.4 +
        timeliness * 0.4 +
        Math.min(revenue / 10000, 100) * 0.2;

      return {
        propertyId: p.id,
        propertyName: p.name,
        totalUnits: totalU,
        occupiedUnits: occupiedU,
        occupancyRate: occupancy,
        avgRent: Math.round(avgR),
        timeliness,
        revenue: Math.round(revenue),
        score: Math.round(score),
        vacantUnits: totalU - occupiedU,
        vacancyLoss: Math.round((totalU - occupiedU) * avgR),
        vacancyAdjustedScore: Math.round(
          occupancy * 0.40 +
          timeliness * 0.20 +
          Math.min(revenue / 10000, 100) * 0.15 +
          (100 - ((totalU - occupiedU) / (totalU || 1)) * 100) * 0.15 +
          Math.min(avgR / (avgRent || 1) * 100, 100) * 0.10
        ),
      };
    })
    .sort((a, b) => b.score - a.score);

  // Tenant insights
  const tenantInsights = allUnits.flatMap((u) => {
    const property = properties.find((p) => p.id === u.propertyId);
    return u.tenantProfiles.map((t) => {
      const tenantPayments = payments.filter((p) => p.tenantId === t.id);
      const completed = tenantPayments.filter(
        (p) => p.status === "COMPLETED"
      );
      const onTime = completed.filter(
        (p) => p.paidAt && p.paidAt <= p.dueDate
      );
      const lateCount = completed.length - onTime.length;
      const paymentScore =
        completed.length > 0
          ? Math.round((onTime.length / completed.length) * 100)
          : 100;
      const tenureMonths = t.leaseStart
        ? Math.round(
            (new Date().getTime() - new Date(t.leaseStart).getTime()) /
              (1000 * 60 * 60 * 24 * 30)
          )
        : 0;

      return {
        tenantId: t.id,
        name: t.user.name,
        unitNumber: u.unitNumber,
        propertyName: property?.name || "\u2014",
        leaseStart: t.leaseStart?.toISOString() || null,
        tenureMonths,
        paymentScore,
        latePayments: lateCount,
        totalPayments: completed.length,
        status:
          tenureMonths > 24 ? "stable" : lateCount > 2 ? "at-risk" : "good",
      };
    });
  });

  return NextResponse.json({
    metrics: {
      occupancyRate,
      avgRentPerSqft: Math.round(avgRentPerSqft * 100) / 100,
      timelinessScore,
      avgTenure,
      totalUnits,
      occupiedUnits,
      vacantUnits,
      avgRent: Math.round(avgRent),
      monthlyVacancyLoss: Math.round(monthlyVacancyLoss),
      dailyVacancyLoss: Math.round(dailyVacancyLoss),
    },
    unitAnalysis,
    buildingPerformance,
    tenantInsights,
  });
}

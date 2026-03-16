import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { getTier, formatCardRate, PLATFORM_ACH_COST } from "@/lib/residual-tiers";
import { EARNINGS_UNLOCK_UNITS } from "@/lib/constants";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const effectiveLandlordId = await getEffectiveLandlordId(session.user.id);
  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from") || undefined;
  const toParam = searchParams.get("to") || undefined;

  const where: Record<string, unknown> = {
    landlordId: effectiveLandlordId,
    status: "COMPLETED",
  };

  if (fromParam || toParam) {
    const paidAtFilter: Record<string, Date> = {};
    if (fromParam) paidAtFilter.gte = new Date(fromParam);
    if (toParam) paidAtFilter.lte = new Date(toParam + "T23:59:59.999Z");
    where.paidAt = paidAtFilter;
  }

  try {
    // Get unit count for tier calculation
    const unitCount = await db.unit.count({
      where: { property: { landlordId: effectiveLandlordId } },
    });

    // Earnings locked until portfolio reaches threshold
    if (unitCount < EARNINGS_UNLOCK_UNITS) {
      return NextResponse.json({ locked: true, unitCount });
    }

    const tier = getTier(unitCount);

    // Get owner info per property for ACH spread calculation
    const properties = await db.property.findMany({
      where: { landlordId: effectiveLandlordId },
      select: { id: true, ownerId: true, owner: { select: { id: true, name: true, achRate: true, billMe: true, achFeeResponsibility: true } } },
    });
    const propertyOwnerMap = new Map(properties.map((p) => [p.id, p.owner]));

    const payments = await db.payment.findMany({
      where,
      include: {
        unit: {
          select: {
            unitNumber: true,
            propertyId: true,
            property: { select: { id: true, name: true, ownerId: true } },
          },
        },
        tenant: { include: { user: { select: { name: true } } } },
      },
      orderBy: { paidAt: "desc" },
    });

    // Calculate residuals based on tier and per-owner ACH spread
    const items = payments.map((p) => {
      const amount = Number(p.amount);
      const isCard = p.paymentMethod === "card";
      const isAch = p.paymentMethod === "ach";

      const propertyId = p.unit?.property?.id;
      const owner = propertyId ? propertyOwnerMap.get(propertyId) : undefined;
      const ownerAchRate = owner ? Number(owner.achRate) : 6;
      const achMode = (owner as any)?.achFeeResponsibility ?? "OWNER";

      return {
        id: p.id,
        date: p.paidAt || p.createdAt,
        tenant: p.tenant?.user?.name || "Unknown",
        unit: p.unit?.unitNumber || "\u2014",
        property: p.unit?.property?.name || "Unknown",
        ownerName: owner?.name || "Unassigned",
        paymentAmount: amount,
        type: isCard ? "card" : isAch ? "ach" : "other",
        surcharge: isCard ? amount * 0.0325 : 0,
        // PM mode: no ACH spread (PM absorbs). TENANT/OWNER: PM earns spread.
        residual: isCard
          ? amount * tier.cardRate
          : isAch
          ? (achMode === "PM" ? 0 : Math.max(0, ownerAchRate - PLATFORM_ACH_COST))
          : 0,
      };
    });

    const cardItems = items.filter((i) => i.type === "card");
    const achItems = items.filter((i) => i.type === "ach");

    const totalCardVolume = cardItems.reduce((sum, i) => sum + i.paymentAmount, 0);
    const totalAchVolume = achItems.reduce((sum, i) => sum + i.paymentAmount, 0);
    const totalCardResiduals = cardItems.reduce((sum, i) => sum + i.residual, 0);
    const totalAchSpreads = achItems.reduce((sum, i) => sum + i.residual, 0);
    const totalAchResiduals = totalAchSpreads;
    const totalResiduals = totalCardResiduals + totalAchResiduals;

    // This month's residuals
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthResiduals = items
      .filter((i) => new Date(i.date) >= monthStart)
      .reduce((sum, i) => sum + i.residual, 0);

    return NextResponse.json({
      items,
      summary: {
        totalTransactions: items.length,
        cardTransactions: cardItems.length,
        achTransactions: achItems.length,
        totalCardVolume,
        totalAchVolume,
        totalVolume: totalCardVolume + totalAchVolume,
        totalCardResiduals,
        totalAchResiduals,
        totalAchSpreads,
        totalResiduals,
        thisMonthResiduals,
      },
      tier: {
        name: tier.name,
        unitCount,
        achPayout: tier.achPayout,
        cardRate: tier.cardRate,
        cardRateFormatted: formatCardRate(tier.cardRate),
      },
    });
  } catch (error) {
    console.error("GET /api/residuals error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { calculateTieredPrice, getTier } from "@/lib/residual-tiers";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);

  const invoices = await db.billingInvoice.findMany({
    where: { userId: landlordId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Current subscription info
  const subscription = await db.subscription.findUnique({
    where: { userId: landlordId },
    select: {
      status: true,
      trialEndsAt: true,
      nextBillingDate: true,
      currentAmount: true,
    },
  });

  const unitCount = await db.unit.count({
    where: { property: { landlordId } },
  });
  const tier = getTier(unitCount);
  const monthlyCost = calculateTieredPrice(unitCount);

  return NextResponse.json({
    invoices,
    subscription: subscription
      ? {
          status: subscription.status,
          trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
          nextBillingDate:
            subscription.nextBillingDate?.toISOString() ?? null,
          currentAmount: Number(subscription.currentAmount),
        }
      : null,
    unitCount,
    tierName: tier.name,
    monthlyCost,
    perUnitRate: tier.perUnitCost,
  });
}

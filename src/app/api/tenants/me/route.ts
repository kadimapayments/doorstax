import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveTenantUserId } from "@/lib/impersonation";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const effectiveUserId = await getEffectiveTenantUserId(session);
  if (!effectiveUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await db.tenantProfile.findUnique({
    where: { userId: effectiveUserId },
    include: {
      unit: {
        select: {
          id: true,
          unitNumber: true,
          rentAmount: true,
          property: {
            select: {
              name: true,
              owner: {
                select: {
                  achFeeResponsibility: true,
                  achRate: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!profile || !profile.unit) {
    return NextResponse.json({ error: "No unit assigned" }, { status: 404 });
  }

  // Look up saved card details from most recent completed card payment
  let savedCardBrand: string | null = null;
  let savedCardLast4: string | null = null;

  if (profile.kadimaCardTokenId) {
    const lastCardPayment = await db.payment.findFirst({
      where: {
        tenantId: profile.id,
        paymentMethod: "card",
        cardLast4: { not: null },
      },
      orderBy: { createdAt: "desc" },
      select: { cardBrand: true, cardLast4: true },
    });

    if (lastCardPayment) {
      savedCardBrand = lastCardPayment.cardBrand;
      savedCardLast4 = lastCardPayment.cardLast4;
    }
  }

  return NextResponse.json({
    id: profile.id,
    unitId: profile.unitId,
    unitNumber: profile.unit.unitNumber,
    propertyName: profile.unit.property.name ?? "",
    rentAmount: Number(profile.unit.rentAmount),
    achFeeMode: (profile.unit.property as any).owner?.achFeeResponsibility ?? "OWNER",
    achFeeAmount: (profile.unit.property as any).owner?.achFeeResponsibility === "TENANT"
      ? Math.min(Number((profile.unit.property as any).owner?.achRate ?? 6), 6)
      : 0,
    splitPercent: profile.splitPercent,
    isPrimary: profile.isPrimary,
    // Saved card info for card-first UX
    hasSavedCard: !!profile.kadimaCardTokenId,
    savedCardBrand,
    savedCardLast4,
    autopayEnabled: profile.autopayEnabled,
    kadimaCustomerId: profile.kadimaCustomerId ?? null,
    kadimaCardTokenId: profile.kadimaCardTokenId ?? null,
  });
}

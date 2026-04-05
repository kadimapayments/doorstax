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
          propertyId: true,
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

  // Resolve ACH fee from property fee schedule > owner fee schedule > owner direct > default
  const propertyFees = await db.property.findFirst({
    where: { id: profile.unit.propertyId },
    include: {
      feeSchedule: { select: { achRate: true, achFeeResponsibility: true } },
      owner: {
        select: {
          achRate: true,
          achFeeResponsibility: true,
          feeSchedule: { select: { achRate: true, achFeeResponsibility: true } },
        },
      },
    },
  });

  const propSched = propertyFees?.feeSchedule;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ownerSched = (propertyFees?.owner as any)?.feeSchedule;
  const ownerDir = propertyFees?.owner;

  const resolvedAchFeeMode =
    propSched?.achFeeResponsibility ??
    ownerSched?.achFeeResponsibility ??
    (ownerDir as any)?.achFeeResponsibility ??
    "OWNER";

  const resolvedAchRate = Number(
    propSched?.achRate ??
    ownerSched?.achRate ??
    (ownerDir as any)?.achRate ??
    6
  );

  return NextResponse.json({
    id: profile.id,
    unitId: profile.unitId,
    unitNumber: profile.unit.unitNumber,
    propertyName: profile.unit.property.name ?? "",
    rentAmount: Number(profile.unit.rentAmount),
    achFeeMode: resolvedAchFeeMode,
    achFeeAmount: resolvedAchFeeMode === "TENANT" ? Math.min(resolvedAchRate, 6) : 0,
    splitPercent: profile.splitPercent,
    isPrimary: profile.isPrimary,
    // Saved card info for card-first UX
    hasSavedCard: !!profile.kadimaCardTokenId,
    savedCardBrand,
    savedCardLast4,
    autopayEnabled: profile.autopayEnabled,
    kadimaCustomerId: profile.kadimaCustomerId ?? null,
    kadimaCardTokenId: profile.kadimaCardTokenId ?? null,
    // Saved ACH info
    hasSavedAch: !!profile.kadimaAccountId,
    savedBankLast4: profile.bankLast4 || null,
    savedBankAccountType: profile.bankAccountType || null,
    kadimaAccountId: profile.kadimaAccountId || null,
  });
}

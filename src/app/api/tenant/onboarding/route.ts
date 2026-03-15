import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const onboardingSchema = z.object({
  phone: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  onboardingStep: z.enum([
    "PERSONAL_DETAILS",
    "PAYMENT_METHOD",
    "ROOMMATES",
    "MOVE_IN_CHECKLIST",
    "DOCUMENTS",
    "LEASE_ACKNOWLEDGMENT",
    "COMPLETE",
  ]).optional(),
});

/* ── GET: fetch tenant onboarding data ── */

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "TENANT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await db.tenantProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      unit: {
        select: {
          unitNumber: true,
          rentAmount: true,
          property: { select: { name: true, address: true, landlordId: true } },
        },
      },
    },
  });

  if (!profile || !profile.unit) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({
    profileId: profile.id,
    name: profile.user.name,
    email: profile.user.email,
    phone: profile.user.phone,
    emergencyContactName: profile.emergencyContactName,
    emergencyContactPhone: profile.emergencyContactPhone,
    property: profile.unit.property.name,
    address: profile.unit.property.address,
    unit: profile.unit.unitNumber,
    rentAmount: Number(profile.unit.rentAmount),
    landlordId: profile.unit.property.landlordId,
    onboardingComplete: profile.onboardingComplete,
    onboardingStep: profile.onboardingStep,
    hasPaymentMethod: !!profile.kadimaCustomerId && !!(profile.kadimaCardTokenId || profile.kadimaAccountId),
    leaseAcknowledgedAt: profile.leaseAcknowledgedAt?.toISOString() || null,
  });
}

/* ── PUT: save personal details ── */

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "TENANT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = onboardingSchema.parse(body);

    // Update user phone if provided
    if (data.phone) {
      await db.user.update({
        where: { id: session.user.id },
        data: { phone: data.phone },
      });
    }

    // Update tenant profile with emergency contact + onboarding step
    await db.tenantProfile.update({
      where: { userId: session.user.id },
      data: {
        emergencyContactName: data.emergencyContactName || null,
        emergencyContactPhone: data.emergencyContactPhone || null,
        ...(data.onboardingStep ? { onboardingStep: data.onboardingStep } : {}),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

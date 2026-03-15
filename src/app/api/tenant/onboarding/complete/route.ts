import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { onboardingCompleteHtml } from "@/lib/emails/onboarding-complete";
import { welcomePacketHtml } from "@/lib/emails/welcome-packet";
import { getResend } from "@/lib/email";

/* ── POST: mark onboarding complete + notify everyone ── */

export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.role !== "TENANT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await db.tenantProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      user: { select: { name: true, email: true } },
      unit: {
        select: {
          unitNumber: true,
          rentAmount: true,
          property: { select: { name: true, landlordId: true } },
        },
      },
      roommateRequests: { where: { status: "PENDING" } },
    },
  });

  if (!profile || !profile.unit) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  if (profile.onboardingComplete) {
    return NextResponse.json({ success: true }); // Already done
  }

  // Mark onboarding complete + set step
  await db.tenantProfile.update({
    where: { id: profile.id },
    data: {
      onboardingComplete: true,
      onboardingStep: "COMPLETE",
    },
  });

  const tenantName = profile.user.name;
  const propertyName = profile.unit.property.name;
  const unitNumber = profile.unit.unitNumber;
  const landlordId = profile.unit.property.landlordId;
  const hasPayment = !!profile.kadimaCustomerId;
  const roommateCount = profile.roommateRequests.length;

  // Get landlord email for notification
  const landlord = await db.user.findUnique({
    where: { id: landlordId },
    select: { email: true, name: true },
  });

  // Notify PM
  if (landlord) {
    await notify({
      userId: landlordId,
      createdById: session.user.id,
      type: "TENANT_ONBOARDED",
      title: "Tenant Onboarding Complete",
      message: `${tenantName} has completed onboarding for ${propertyName} - Unit ${unitNumber}. Payment method: ${hasPayment ? "stored" : "skipped"}. Roommate requests: ${roommateCount}.`,
      severity: "info",
      email: {
        to: landlord.email,
        subject: `${tenantName} completed onboarding — ${propertyName} Unit ${unitNumber}`,
        html: onboardingCompleteHtml({
          tenantName,
          propertyName,
          unitNumber,
          hasPaymentMethod: hasPayment,
          roommateRequestCount: roommateCount,
          landlordName: landlord.name,
          tenantProfileId: profile.id,
        }),
      },
    });
  }

  // Notify tenant (in-app only)
  await notify({
    userId: session.user.id,
    createdById: session.user.id,
    type: "WELCOME",
    title: "Welcome to DoorStax!",
    message: `Your tenant portal is now live. You can pay rent, view your lease, and communicate with your property manager from your dashboard.`,
    severity: "info",
  });

  // Send welcome packet email (if configured)
  try {
    const propertyId = profile.unit?.property
      ? (
          await db.property.findFirst({
            where: { name: propertyName, landlordId },
            select: { id: true },
          })
        )?.id
      : null;

    // Find welcome packet: property-specific first, then default
    const welcomePacket = await db.welcomePacket.findFirst({
      where: {
        landlordId,
        isActive: true,
        ...(propertyId
          ? { OR: [{ propertyId }, { propertyId: null }] }
          : { propertyId: null }),
      },
      orderBy: { propertyId: "desc" }, // property-specific first
    });

    if (welcomePacket) {
      const baseUrl =
        process.env.NEXTAUTH_URL || "https://sandbox.doorstax.com";
      const html = welcomePacketHtml({
        tenantName,
        propertyName,
        unitNumber,
        landlordName: landlord?.name || "Your Property Manager",
        subject: welcomePacket.subject,
        body: welcomePacket.body,
        dashboardUrl: `${baseUrl}/tenant`,
      });

      const resend = getResend();
      await resend.emails.send({
        from: "DoorStax <noreply@doorstax.com>",
        to: profile.user.email,
        subject: welcomePacket.subject,
        html,
      });
    }
  } catch (err) {
    // Non-blocking — log but don't fail onboarding
    console.error("Welcome packet email error:", err);
  }

  return NextResponse.json({ success: true });
}

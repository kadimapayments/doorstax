import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateApplyLink, isRentSpreeConfigured } from "@/lib/rentspree/client";
import { resolveScreeningConfig } from "@/lib/rentspree/screening-config";
import { screeningInvitationEmail } from "@/lib/emails/screening-invitation";
import { getResend } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (
      !session?.user?.id ||
      (session.user.role !== "PM" && session.user.role !== "ADMIN")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { unitId, emails } = await req.json();
    if (!unitId || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { error: "unitId and emails[] are required" },
        { status: 400 }
      );
    }

    // Validate emails
    const validEmails = emails.filter(
      (e: string) => typeof e === "string" && e.includes("@")
    );
    if (validEmails.length === 0) {
      return NextResponse.json(
        { error: "No valid email addresses provided" },
        { status: 400 }
      );
    }

    // Fetch unit with property info + verify PM ownership
    const unit = await db.unit.findFirst({
      where: {
        id: unitId,
        property: { landlordId: session.user.id },
      },
      select: {
        id: true,
        unitNumber: true,
        applyLink: true,
        applyLinkFull: true,
        property: { select: { name: true, address: true } },
      },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    // Fetch PM info
    const pm = await db.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, companyName: true },
    });

    // Resolve screening config
    const config = await resolveScreeningConfig(unitId, session.user.id);

    // Generate or reuse existing apply link
    let applyLink = unit.applyLink;
    let isMock = false;

    if (!applyLink) {
      if (!isRentSpreeConfigured()) {
        applyLink = `https://apply.link/mock-${unitId.slice(0, 6)}`;
        isMock = true;
        await db.unit.update({
          where: { id: unitId },
          data: {
            applyLink,
            applyLinkFull: `https://partner.rentspree.com/apply/mock-${unitId}`,
            rentspreeScreeningOptId: `mock-${Date.now()}`,
            applyLinkGeneratedAt: new Date(),
          },
        });
      } else {
        const result = await generateApplyLink(config);
        applyLink = result.applyLink.shortenLink;
        await db.unit.update({
          where: { id: unitId },
          data: {
            applyLink: result.applyLink.shortenLink,
            applyLinkFull: result.applyLink.fullLink,
            rentspreeScreeningOptId: result.screeningOption._id,
            applyLinkGeneratedAt: new Date(),
          },
        });
      }
    }

    // Build screening includes list
    const screeningIncludes: string[] = [];
    if (config.creditReport) screeningIncludes.push("Credit Report");
    if (config.criminal) screeningIncludes.push("Criminal Background Check");
    if (config.eviction) screeningIncludes.push("Eviction History");
    if (config.application) screeningIncludes.push("Rental Application");

    // Generate branded email HTML
    const html = screeningInvitationEmail({
      propertyName: unit.property.name,
      unitName: `Unit ${unit.unitNumber}`,
      pmName: pm?.name || "Your Property Manager",
      pmCompany: pm?.companyName || undefined,
      applyLink,
      screeningIncludes,
      payerType: config.payerType,
    });

    const subject = `Apply for ${unit.property.name} \u2014 Unit ${unit.unitNumber}`;

    // Send emails via Resend
    const resend = getResend();
    let sent = 0;
    const failedEmails: string[] = [];

    for (const email of validEmails) {
      try {
        await resend.emails.send({
          from: "DoorStax <noreply@doorstax.com>",
          to: email,
          subject,
          html,
        });

        // Create invitation record
        await db.screeningInvitation.create({
          data: {
            unitId,
            email,
            applyLink,
            sentById: session.user.id,
          },
        });
        sent++;
      } catch (err) {
        console.error(`[rentspree/send-invitation] Failed for ${email}:`, err);
        failedEmails.push(email);
      }
    }

    return NextResponse.json({
      sent,
      failed: failedEmails.length,
      ...(failedEmails.length > 0 && { failedEmails }),
      applyLink,
      ...(isMock && { mock: true }),
    });
  } catch (err) {
    console.error("[rentspree/send-invitation]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to send screening invitations",
      },
      { status: 500 }
    );
  }
}

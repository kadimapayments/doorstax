import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";
import { isDisposableEmail, isValidEmail } from "@/lib/email-validation";
import { getResend } from "@/lib/email";
import { applicationVerificationEmail } from "@/lib/emails/application-verification";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ unitId: string }> }
) {
  try {
    const { unitId } = await params;
    const body = await req.json();
    const email = (body.email || "").trim().toLowerCase();

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 }
      );
    }

    if (isDisposableEmail(email)) {
      return NextResponse.json(
        { error: "Please use a permanent email address, not a temporary one" },
        { status: 400 }
      );
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    // Rate limit: max 3 per email per 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const emailCount = await db.applicationToken.count({
      where: { email, unitId, createdAt: { gte: oneDayAgo } },
    });
    if (emailCount >= 3) {
      return NextResponse.json(
        {
          error:
            "Application link already sent. Please check your email including spam folder.",
        },
        { status: 429 }
      );
    }

    // Rate limit: max 10 per IP per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const ipCount = await db.applicationToken.count({
      where: { ipAddress: ip, createdAt: { gte: oneHourAgo } },
    });
    if (ipCount >= 10) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    // Verify unit exists
    const unit = await db.unit.findUnique({
      where: { id: unitId },
      select: {
        id: true,
        unitNumber: true,
        property: { select: { name: true } },
      },
    });
    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    // Generate token
    const token = randomBytes(48).toString("base64url");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.applicationToken.create({
      data: { token, email, unitId, expiresAt, ipAddress: ip },
    });

    // Send email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com";
    const applyLink = `${appUrl}/apply/${unitId}?token=${token}`;

    try {
      const resend = getResend();
      await resend.emails.send({
        from: "DoorStax <noreply@doorstax.com>",
        to: email,
        subject: `Your Application Link \u2014 ${unit.property?.name || "Property"} Unit ${unit.unitNumber}`,
        html: applicationVerificationEmail({
          propertyName: unit.property?.name || "Property",
          unitName: `Unit ${unit.unitNumber}`,
          applyLink,
          expiresIn: "24 hours",
        }),
      });
    } catch (err) {
      console.error("[apply/request] Email failed:", err);
    }

    return NextResponse.json({
      success: true,
      message: `Application link sent to ${email}`,
    });
  } catch (err) {
    console.error("[apply/request] Error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

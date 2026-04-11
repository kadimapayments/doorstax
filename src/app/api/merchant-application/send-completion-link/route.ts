import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getKadimaBoardingUrl } from "@/lib/kadima/lead";

/**
 * Steps summary helper — derives human-readable "completed" /
 * "remaining" strings from the MerchantApplication's currentStep and
 * status so the email can tell the PM what's left.
 */
function describeSteps(app: {
  status: string;
  currentStep: number;
  businessLegalName: string | null;
  bankAccountNumber: string | null;
  agreementSignedAt: Date | null;
}): { completed: string; remaining: string } {
  if (app.agreementSignedAt || app.status === "SUBMITTED") {
    return {
      completed:
        "Business info, principal details, processing details, and e-signature",
      remaining: "Kadima review and terminal provisioning",
    };
  }
  if (app.bankAccountNumber) {
    return {
      completed:
        "Business info, principal details, and processing details",
      remaining: "Document upload and e-signature",
    };
  }
  if (app.businessLegalName) {
    return {
      completed: "Account creation and basic business info",
      remaining:
        "Principal details, processing info, bank information, document upload, and e-signature",
    };
  }
  return {
    completed: "Account creation",
    remaining:
      "Business info, principal details, processing details, bank information, and e-signature",
  };
}

async function resolveUrl(
  app: {
    id: string;
    kadimaAppId: string | null;
    kadimaApplicationUrl: string | null;
  }
): Promise<string | null> {
  // Prefer cached URL, refresh from Kadima if missing.
  if (app.kadimaApplicationUrl) return app.kadimaApplicationUrl;
  if (!app.kadimaAppId) return null;
  const url = await getKadimaBoardingUrl(app.kadimaAppId);
  if (url) {
    await db.merchantApplication
      .update({
        where: { id: app.id },
        data: { kadimaApplicationUrl: url },
      })
      .catch(() => {});
  }
  return url;
}

/* ── GET: return the URL (for copy-link buttons) ──────────────── */

export async function GET() {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "PM" && session.user.role !== "ADMIN")
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const app = await db.merchantApplication.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      kadimaAppId: true,
      kadimaApplicationUrl: true,
      status: true,
      createdAt: true,
    },
  });

  if (!app) {
    return NextResponse.json(
      { error: "Merchant application not found" },
      { status: 404 }
    );
  }

  const url = await resolveUrl(app);
  // It's OK to return null url here so the UI can still show status.
  return NextResponse.json({
    url,
    status: app.status,
    createdAt: app.createdAt.toISOString(),
  });
}

/* ── POST: send the branded email to the PM ──────────────────── */

export async function POST() {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "PM" && session.user.role !== "ADMIN")
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const app = await db.merchantApplication.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      kadimaAppId: true,
      kadimaApplicationUrl: true,
      status: true,
      currentStep: true,
      businessLegalName: true,
      bankAccountNumber: true,
      agreementSignedAt: true,
      dba: true,
    },
  });

  if (!app) {
    return NextResponse.json(
      { error: "Merchant application not found" },
      { status: 404 }
    );
  }

  if (app.status === "APPROVED") {
    return NextResponse.json(
      { error: "Your application has already been approved." },
      { status: 400 }
    );
  }

  const pmUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true },
  });
  if (!pmUser?.email) {
    return NextResponse.json(
      { error: "No email on file for this account" },
      { status: 400 }
    );
  }

  const url = await resolveUrl(app);
  if (!url) {
    return NextResponse.json(
      {
        error:
          "Could not retrieve application link. Please contact support if this persists.",
      },
      { status: 503 }
    );
  }

  const { completed, remaining } = describeSteps(app);

  try {
    const { getResend } = await import("@/lib/email");
    const { merchantApplicationContinueEmail } = await import(
      "@/lib/emails/merchant-application-continue"
    );

    await getResend().emails.send({
      from: "DoorStax <noreply@doorstax.com>",
      to: pmUser.email,
      subject: "Continue Your Merchant Application \u2014 DoorStax",
      html: merchantApplicationContinueEmail({
        pmName: pmUser.name || "Property Manager",
        companyName: app.businessLegalName || app.dba || undefined,
        applicationUrl: url,
        stepsCompleted: completed,
        stepsRemaining: remaining,
      }),
    });

    await db.merchantApplication
      .update({
        where: { id: app.id },
        data: { lastReminderSentAt: new Date() },
      })
      .catch(() => {});

    return NextResponse.json({ sent: true, url });
  } catch (err) {
    console.error("[merchant-app/send-completion-link] send failed:", err);
    return NextResponse.json(
      { error: "Failed to send email. Please try again." },
      { status: 500 }
    );
  }
}

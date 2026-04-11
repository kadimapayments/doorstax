import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getKadimaBoardingUrl } from "@/lib/kadima/lead";
import { getResend } from "@/lib/email";
import { merchantApplicationContinueEmail } from "@/lib/emails/merchant-application-continue";

/**
 * Daily reminder cron for PMs with incomplete merchant applications.
 *
 * Finds merchant applications that are:
 *   - status NOT_STARTED / IN_PROGRESS / SUBMITTED (NOT APPROVED or REJECTED)
 *   - the parent user was created at least 3 days ago
 *   - lastReminderSentAt was at least 7 days ago, or null
 *
 * Sends each one a branded "Continue Your Merchant Application" email
 * with the Kadima hosted-completion URL.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const candidates = await db.merchantApplication.findMany({
    where: {
      status: { in: ["NOT_STARTED", "IN_PROGRESS", "SUBMITTED"] },
      user: { createdAt: { lte: threeDaysAgo } },
      OR: [
        { lastReminderSentAt: null },
        { lastReminderSentAt: { lte: sevenDaysAgo } },
      ],
    },
    select: {
      id: true,
      kadimaAppId: true,
      kadimaApplicationUrl: true,
      status: true,
      businessLegalName: true,
      dba: true,
      bankAccountNumber: true,
      agreementSignedAt: true,
      user: { select: { email: true, name: true } },
    },
    take: 200,
  });

  let sent = 0;
  let skipped = 0;
  const failures: string[] = [];
  const resend = getResend();

  for (const app of candidates) {
    if (!app.user?.email) {
      skipped++;
      continue;
    }

    // Resolve URL — prefer cached, refetch if missing.
    let url = app.kadimaApplicationUrl;
    if (!url && app.kadimaAppId) {
      url = await getKadimaBoardingUrl(app.kadimaAppId);
      if (url) {
        await db.merchantApplication
          .update({
            where: { id: app.id },
            data: { kadimaApplicationUrl: url },
          })
          .catch(() => {});
      }
    }

    if (!url) {
      skipped++;
      continue;
    }

    // Build step summary
    const completed =
      app.agreementSignedAt || app.status === "SUBMITTED"
        ? "Business info, principal details, processing details, and e-signature"
        : app.bankAccountNumber
        ? "Business info, principal details, and processing details"
        : app.businessLegalName
        ? "Account creation and basic business info"
        : "Account creation";
    const remaining =
      app.agreementSignedAt || app.status === "SUBMITTED"
        ? "Kadima review and terminal provisioning"
        : app.bankAccountNumber
        ? "Document upload and e-signature"
        : app.businessLegalName
        ? "Principal details, processing info, bank information, document upload, and e-signature"
        : "Business info, principal details, processing details, bank information, and e-signature";

    try {
      await resend.emails.send({
        from: "DoorStax <noreply@doorstax.com>",
        to: app.user.email,
        subject: "Finish Your Merchant Application \u2014 DoorStax",
        html: merchantApplicationContinueEmail({
          pmName: app.user.name || "Property Manager",
          companyName: app.businessLegalName || app.dba || undefined,
          applicationUrl: url,
          stepsCompleted: completed,
          stepsRemaining: remaining,
          isReminder: true,
        }),
      });
      await db.merchantApplication.update({
        where: { id: app.id },
        data: { lastReminderSentAt: new Date() },
      });
      sent++;
    } catch (err) {
      console.error(
        `[cron/merchant-app-reminder] Failed to send to ${app.user.email}:`,
        err
      );
      failures.push(app.id);
    }
  }

  return NextResponse.json({
    checked: candidates.length,
    sent,
    skipped,
    failed: failures.length,
  });
}

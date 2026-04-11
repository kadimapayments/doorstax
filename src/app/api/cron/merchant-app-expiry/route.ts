import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * 30-day Merchant Application Expiry Cron
 *
 * Daily job that:
 *   1. Expires merchant applications older than 30 days that are still
 *      NOT_STARTED / IN_PROGRESS / SUBMITTED (i.e. never got to APPROVED)
 *   2. Sends the PM a branded "application expired" email
 *   3. Creates an in-app dashboard notice
 *   4. Sends a 7-day warning email to apps that are ~23 days old
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  // ── 1. Expire applications past the 30-day window ──────────
  const expiredApps = await db.merchantApplication.findMany({
    where: {
      status: { in: ["NOT_STARTED", "IN_PROGRESS", "SUBMITTED"] },
      createdAt: { lt: thirtyDaysAgo },
    },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
  });

  let cancelled = 0;
  let emailsSent = 0;

  for (const app of expiredApps) {
    try {
      await db.merchantApplication.update({
        where: { id: app.id },
        data: { status: "EXPIRED" },
      });

      // In-app notice
      try {
        const { notify } = await import("@/lib/notifications");
        await notify({
          userId: app.userId,
          createdById: app.userId,
          type: "MERCHANT_APP_EXPIRED",
          title: "Merchant Application Expired",
          message:
            "Your merchant application has expired after 30 days of inactivity. Please contact support to restart the process.",
          severity: "urgent",
          actionUrl: "/dashboard/settings",
        }).catch(console.error);
      } catch {}

      // Email
      if (app.user?.email) {
        try {
          const { getResend } = await import("@/lib/email");
          const { merchantApplicationExpiredEmail } = await import(
            "@/lib/emails/merchant-application-expired"
          );
          await getResend().emails.send({
            from: "DoorStax <noreply@doorstax.com>",
            to: app.user.email,
            subject: "Merchant Application Expired \u2014 DoorStax",
            html: merchantApplicationExpiredEmail({
              pmName: app.user.name || "Property Manager",
            }),
          });
          emailsSent++;
        } catch (e) {
          console.error("[merchant-expiry] Email failed:", e);
        }
      }

      cancelled++;
    } catch (e) {
      console.error("[merchant-expiry] Failed to expire app", app.id, e);
    }
  }

  // ── 2. Send 7-day warning for apps between 22 and 23 days old ──
  const twentyTwoDaysAgo = new Date(now - 22 * 24 * 60 * 60 * 1000);
  const twentyThreeDaysAgo = new Date(now - 23 * 24 * 60 * 60 * 1000);

  const warningApps = await db.merchantApplication.findMany({
    where: {
      status: { in: ["NOT_STARTED", "IN_PROGRESS", "SUBMITTED"] },
      createdAt: { gte: twentyThreeDaysAgo, lt: twentyTwoDaysAgo },
    },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
  });

  let warnings = 0;
  for (const app of warningApps) {
    try {
      await db.dashboardNotice.create({
        data: {
          targetUserId: app.userId,
          createdById: app.userId,
          type: "MERCHANT_APP_EXPIRING",
          title: "Merchant Application Expiring Soon",
          message:
            "Your merchant application will expire in 7 days if not completed. Complete it now to start accepting payments.",
          severity: "warning",
          actionUrl: "/dashboard/settings",
        },
      });

      if (app.user?.email && app.kadimaApplicationUrl) {
        try {
          const { getResend } = await import("@/lib/email");
          const { merchantApplicationContinueEmail } = await import(
            "@/lib/emails/merchant-application-continue"
          );
          const expiresOn = new Date(
            app.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000
          ).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          });
          await getResend().emails.send({
            from: "DoorStax <noreply@doorstax.com>",
            to: app.user.email,
            subject:
              "Action Required: Merchant Application Expires in 7 Days",
            html: merchantApplicationContinueEmail({
              pmName: app.user.name || "Property Manager",
              applicationUrl: app.kadimaApplicationUrl,
              isReminder: true,
              stepsRemaining: `Complete before ${expiresOn}`,
            }),
          });
          emailsSent++;
        } catch (e) {
          console.error("[merchant-expiry] Warning email failed:", e);
        }
      }

      warnings++;
    } catch (e) {
      console.error("[merchant-expiry] Warning create failed:", e);
    }
  }

  return NextResponse.json({
    expired: cancelled,
    warnings,
    emailsSent,
    timestamp: new Date().toISOString(),
  });
}

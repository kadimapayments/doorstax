import { withCronGuard } from "@/lib/cron-guard";
import {
  sendPreChargeNotifications,
  sendEnrollmentReminders,
} from "@/lib/autopay-engine";

/**
 * Autopay Reminders Cron
 *
 * 1. Sends pre-charge notifications to tenants 3 days before autopay
 * 2. Sends enrollment reminders to unenrolled tenants (max 1 per 30 days)
 *
 * Schedule: 0 14 * * * (daily at 2 PM UTC)
 */
export const GET = withCronGuard("autopay-reminders", async () => {
  const preCharge = await sendPreChargeNotifications();
  const enrollment = await sendEnrollmentReminders();

  return {
    summary: {
      preChargeNotifications: preCharge.sent,
      enrollmentReminders: enrollment.sent,
      message: `Sent ${preCharge.sent} pre-charge notifications, ${enrollment.sent} enrollment reminders`,
    },
  };
});

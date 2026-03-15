import { db } from "@/lib/db";
import { getResend } from "@/lib/email";

/**
 * Centralized notification helper.
 * Creates an in-app DashboardNotice and optionally sends an email.
 */
export async function notify(opts: {
  userId: string;
  createdById: string;
  type: string;
  title: string;
  message: string;
  severity?: "info" | "warning" | "urgent";
  amount?: number;
  email?: {
    to: string;
    subject: string;
    html: string;
  };
}) {
  const { userId, createdById, type, title, message, severity, amount, email } = opts;

  // Create in-app notice
  await db.dashboardNotice.create({
    data: {
      targetUserId: userId,
      createdById,
      type,
      title,
      message,
      severity: severity ?? "info",
      amount: amount ?? null,
    },
  });

  // Send email (non-blocking — don't let failures break the caller)
  if (email) {
    try {
      await getResend().emails.send({
        from: "DoorStax <notifications@doorstax.com>",
        to: email.to,
        subject: email.subject,
        html: email.html,
      });
    } catch (err) {
      console.error("[notify] Email send failed:", err);
    }
  }
}

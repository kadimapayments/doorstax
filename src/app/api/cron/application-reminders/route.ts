import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getResend } from "@/lib/email";
import { applicationReminderEmail } from "@/lib/emails/application-reminder";

export async function GET() {
  try {
    const now = new Date();

    // Find candidate tokens: not used, not expired, under max reminders
    const tokens = await db.applicationToken.findMany({
      where: {
        usedAt: null,
        expiresAt: { gt: now },
        remindersSent: { lt: 5 }, // Safety ceiling
        marketingOptOut: false,
      },
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
            status: true,
            listingEnabled: true,
            applicationTemplateId: true,
            applicationTemplate: {
              select: {
                reminderEnabled: true,
                reminderDelayHours: true,
                reminderMaxCount: true,
                reminderIntervalHours: true,
              },
            },
            property: {
              select: {
                name: true,
                landlordId: true,
                applicationTemplate: {
                  select: {
                    reminderEnabled: true,
                    reminderDelayHours: true,
                    reminderMaxCount: true,
                    reminderIntervalHours: true,
                  },
                },
              },
            },
            tenantProfiles: {
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });

    let remindersSent = 0;
    let skipped = 0;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com";
    const resend = getResend();

    for (const token of tokens) {
      const unit = token.unit;
      if (!unit || !unit.property) {
        skipped++;
        continue;
      }

      // Resolve template settings: unit template > property template > defaults
      const template =
        unit.applicationTemplate || unit.property.applicationTemplate;
      const reminderEnabled = template?.reminderEnabled ?? true;
      const maxReminders = template?.reminderMaxCount ?? 3;
      const delayHours = template?.reminderDelayHours ?? 24;
      const intervalHours = template?.reminderIntervalHours ?? 48;

      if (!reminderEnabled) {
        skipped++;
        continue;
      }
      if (token.remindersSent >= maxReminders) {
        skipped++;
        continue;
      }

      // Check if unit is still available
      const isUnitAvailable =
        unit.status === "AVAILABLE" &&
        unit.listingEnabled !== false &&
        unit.tenantProfiles.length === 0;

      if (!isUnitAvailable) {
        // Unit filled or delisted — don't send reminder
        skipped++;
        continue;
      }

      // Timing check
      const referenceTime = token.lastReminderAt || token.createdAt;
      const hoursToWait = token.remindersSent === 0 ? delayHours : intervalHours;
      const nextReminderAt = new Date(
        referenceTime.getTime() + hoursToWait * 60 * 60 * 1000
      );

      if (now < nextReminderAt) {
        skipped++;
        continue;
      }

      // Send reminder
      try {
        const reminderNumber = token.remindersSent + 1;
        const isLastReminder = reminderNumber >= maxReminders;
        const applyLink = `${appUrl}/apply/${unit.id}?token=${token.token}`;

        const html = applicationReminderEmail({
          propertyName: unit.property.name,
          unitName: `Unit ${unit.unitNumber}`,
          applyLink,
          reminderNumber,
          isLastReminder,
        });

        const subject = isLastReminder
          ? `Last Chance: Complete Your Application \u2014 ${unit.property.name} Unit ${unit.unitNumber}`
          : `Reminder: Complete Your Application \u2014 ${unit.property.name} Unit ${unit.unitNumber}`;

        await resend.emails.send({
          from: "DoorStax <noreply@doorstax.com>",
          to: token.email,
          subject,
          html,
        });

        await db.applicationToken.update({
          where: { id: token.id },
          data: {
            remindersSent: { increment: 1 },
            lastReminderAt: now,
          },
        });

        remindersSent++;
      } catch (err) {
        console.error(
          `[application-reminders] Failed to send to ${token.email}:`,
          err
        );
      }
    }

    return NextResponse.json({
      processed: tokens.length,
      remindersSent,
      skipped,
      timestamp: now.toISOString(),
    });
  } catch (err) {
    console.error("[application-reminders] Error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

import { withCronGuard } from "@/lib/cron-guard";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { rentDueReminderHtml } from "@/lib/emails/rent-due-reminder";
import { formatCurrency } from "@/lib/utils";

/**
 * Rent Due Reminder Cron
 *
 * Sends email reminders to tenants 3 days before their rent is due.
 * Only sends to tenants WITHOUT autopay enabled (autopay tenants
 * get their own pre-charge notifications via the autopay-reminders cron).
 *
 * Schedule: 0 15 * * * (daily at 3 PM UTC / 10 AM ET)
 */
export const GET = withCronGuard("rent-reminders", async () => {
  const now = new Date();
  const threeDaysFromNow = new Date(now);
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  const targetDay = threeDaysFromNow.getDate();

  // Find active tenants whose due day matches 3 days from now
  // and who do NOT have autopay enabled
  const tenants = await db.tenantProfile.findMany({
    where: {
      status: "ACTIVE",
      autopayEnabled: false,
      unitId: { not: null },
      unit: {
        dueDay: targetDay,
      },
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      unit: {
        select: {
          unitNumber: true,
          rentAmount: true,
          dueDay: true,
          property: {
            select: { name: true, landlordId: true },
          },
        },
      },
    },
  });

  let sent = 0;

  for (const tenant of tenants) {
    if (!tenant.user?.email || !tenant.unit) continue;

    const rentAmount = Number(tenant.unit.rentAmount) * tenant.splitPercent / 100;
    const dueDate = new Date(now.getFullYear(), now.getMonth(), tenant.unit.dueDay);
    // If dueDay already passed this month, it's for next month
    if (dueDate < now) {
      dueDate.setMonth(dueDate.getMonth() + 1);
    }

    const formattedDueDate = dueDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    await notify({
      userId: tenant.user.id,
      createdById: tenant.unit.property.landlordId,
      type: "RENT_REMINDER",
      title: "Rent Payment Reminder",
      message: `Your rent of ${formatCurrency(rentAmount)} for ${tenant.unit.property.name} Unit ${tenant.unit.unitNumber} is due on ${formattedDueDate}.`,
      severity: "info",
      amount: rentAmount,
      email: {
        to: tenant.user.email,
        subject: `Rent Reminder — ${formatCurrency(rentAmount)} due ${formattedDueDate}`,
        html: rentDueReminderHtml({
          tenantName: tenant.user.name || "Tenant",
          amount: formatCurrency(rentAmount),
          dueDate: formattedDueDate,
          propertyName: tenant.unit.property.name,
          unitNumber: tenant.unit.unitNumber,
        }),
      },
    }).catch(console.error);

    sent++;
  }

  return {
    summary: {
      targetDueDay: targetDay,
      tenantsChecked: tenants.length,
      remindersSent: sent,
    },
  };
});

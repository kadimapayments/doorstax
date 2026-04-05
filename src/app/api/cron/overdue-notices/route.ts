import { withCronGuard } from "@/lib/cron-guard";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { rentOverdueHtml } from "@/lib/emails/rent-overdue";
import { formatCurrency } from "@/lib/utils";

/**
 * Overdue Rent Notice Cron
 *
 * Sends escalating overdue notices to tenants with unpaid rent.
 * Runs daily and checks for rent that is 1, 5, 15, or 30+ days late.
 * Uses DomainEvent for deduplication — only sends each tier once per month.
 *
 * Schedule: 0 16 * * * (daily at 4 PM UTC / 11 AM ET)
 */
export const GET = withCronGuard("overdue-notices", async () => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Find active tenants with unpaid rent this month
  const tenants = await db.tenantProfile.findMany({
    where: {
      status: "ACTIVE",
      unitId: { not: null },
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
      payments: {
        where: {
          type: "RENT",
          status: "COMPLETED",
          dueDate: {
            gte: new Date(currentYear, currentMonth, 1),
            lt: new Date(currentYear, currentMonth + 1, 1),
          },
        },
        select: { id: true },
      },
    },
  });

  let sent = 0;
  let skipped = 0;
  const OVERDUE_TIERS = [1, 5, 15, 30];

  for (const tenant of tenants) {
    if (!tenant.user?.email || !tenant.unit) continue;

    // Skip if rent is paid this month
    if (tenant.payments.length > 0) {
      skipped++;
      continue;
    }

    // Calculate days overdue
    const dueDate = new Date(currentYear, currentMonth, tenant.unit.dueDay);
    if (now <= dueDate) {
      skipped++;
      continue; // Not overdue yet
    }

    const daysLate = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    // Determine which tier applies
    const applicableTier = [...OVERDUE_TIERS].reverse().find((t) => daysLate >= t);
    if (!applicableTier) {
      skipped++;
      continue;
    }

    // Deduplication: check if we already sent this tier this month
    const periodKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
    const alreadySent = await db.domainEvent.findFirst({
      where: {
        eventType: "rent.overdue_notice",
        aggregateType: "TenantProfile",
        aggregateId: tenant.id,
        payload: {
          path: ["tier"],
          equals: applicableTier,
        },
        createdAt: {
          gte: new Date(currentYear, currentMonth, 1),
        },
      },
    });

    if (alreadySent) {
      skipped++;
      continue;
    }

    const rentAmount = Number(tenant.unit.rentAmount) * tenant.splitPercent / 100;
    const formattedDueDate = dueDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const severity: "info" | "warning" | "urgent" = daysLate >= 15 ? "urgent" : daysLate >= 5 ? "warning" : "info";

    await notify({
      userId: tenant.user.id,
      createdById: tenant.unit.property.landlordId,
      type: "RENT_OVERDUE",
      title: `Rent ${daysLate} Day${daysLate !== 1 ? "s" : ""} Overdue`,
      message: `Your rent of ${formatCurrency(rentAmount)} was due on ${formattedDueDate}. Please pay immediately.`,
      severity,
      amount: rentAmount,
      email: {
        to: tenant.user.email,
        subject: `Overdue Rent Notice — ${daysLate} Day${daysLate !== 1 ? "s" : ""} Past Due`,
        html: rentOverdueHtml({
          tenantName: tenant.user.name || "Tenant",
          amount: formatCurrency(rentAmount),
          dueDate: formattedDueDate,
          daysLate,
          propertyName: tenant.unit.property.name,
          unitNumber: tenant.unit.unitNumber,
        }),
      },
    }).catch(console.error);

    // Also notify PM for 5+ days overdue
    if (daysLate >= 5) {
      await notify({
        userId: tenant.unit.property.landlordId,
        createdById: tenant.user.id,
        type: "RENT_OVERDUE",
        title: `Overdue: ${tenant.user.name} — ${daysLate} days`,
        message: `${tenant.user.name} at ${tenant.unit.property.name} Unit ${tenant.unit.unitNumber} is ${daysLate} days overdue (${formatCurrency(rentAmount)}).`,
        severity,
      }).catch(console.error);
    }

    // Track deduplication
    const { emit } = await import("@/lib/events/emitter");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await emit({
      eventType: "rent.overdue_notice" as any,
      aggregateType: "TenantProfile",
      aggregateId: tenant.id,
      payload: { tier: applicableTier, daysLate, periodKey },
      emittedBy: "system",
    }).catch(console.error);

    sent++;
  }

  return {
    summary: {
      tenantsChecked: tenants.length,
      overdueSent: sent,
      skipped,
    },
  };
});

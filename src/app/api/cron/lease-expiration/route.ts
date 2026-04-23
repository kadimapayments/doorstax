import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { auditLog } from "@/lib/audit";
import { leaseExpirationHtml } from "@/lib/emails/lease-expiration";
import { emit } from "@/lib/events/emitter";
import { formatCurrency, formatDate } from "@/lib/utils";

// Thresholds in descending order
const PM_THRESHOLDS = [90, 60, 30, 14, 7];
const TENANT_THRESHOLDS = [30, 14];
const PM_EMAIL_THRESHOLDS = [30, 14, 7];
const TENANT_EMAIL_THRESHOLDS = [30, 14];

/**
 * Daily Lease Expiration Check
 * Runs every day at 7 AM UTC.
 * - Sends tiered alerts to PM (90, 60, 30, 14, 7 days)
 * - Sends alerts to tenant (30, 14 days)
 * - Auto-expires leases past endDate
 * - Uses lastAlertDays on Lease model for deduplication
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const ninetyDaysOut = new Date(now);
  ninetyDaysOut.setDate(ninetyDaysOut.getDate() + 90);

  // Find all ACTIVE leases expiring within 90 days (or already past)
  const leases = await db.lease.findMany({
    where: {
      status: "ACTIVE",
      endDate: { lte: ninetyDaysOut },
    },
    include: {
      tenant: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      unit: {
        select: { unitNumber: true, property: { select: { name: true } } },
      },
      property: { select: { name: true } },
      landlord: { select: { id: true, name: true, email: true } },
    },
  });

  let alertsSent = 0;
  let expired = 0;
  let skipped = 0;

  for (const lease of leases) {
    // Month-to-month leases (endDate=null) have no scheduled expiration;
    // skip entirely. The cron's job is to expire fixed-term leases and
    // alert PMs/tenants ahead of endDate — neither applies here.
    if (!lease.endDate) {
      skipped++;
      continue;
    }
    const msRemaining = lease.endDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
    const propertyName = lease.property.name;
    const unitNumber = lease.unit.unitNumber;

    // Auto-expire if endDate has passed
    if (daysRemaining <= 0) {
      await db.lease.update({
        where: { id: lease.id },
        data: { status: "EXPIRED", lastAlertDays: 0 },
      });

      notify({
        userId: lease.landlordId,
        createdById: lease.landlordId,
        type: "LEASE_EXPIRED",
        title: "Lease Expired",
        message: `Lease for ${lease.tenant.user.name} at ${propertyName} Unit ${unitNumber} has expired.`,
        severity: "urgent",
      }).catch(console.error);

      auditLog({
        action: "UPDATE",
        objectType: "Lease",
        objectId: lease.id,
        description: `Auto-expired lease (endDate: ${formatDate(lease.endDate)})`,
        newValue: { status: "EXPIRED" },
      });

      expired++;
      continue;
    }

    // Determine which threshold applies
    const applicableThreshold = PM_THRESHOLDS.find((t) => daysRemaining <= t);
    if (!applicableThreshold) {
      skipped++;
      continue;
    }

    // Deduplication: skip if already sent this threshold or a lower one
    if (lease.lastAlertDays !== null && lease.lastAlertDays <= applicableThreshold) {
      skipped++;
      continue;
    }

    const severity: "info" | "warning" | "urgent" =
      daysRemaining <= 7 ? "urgent" : daysRemaining <= 14 ? "warning" : "info";

    const formattedEndDate = formatDate(lease.endDate);
    const formattedRent = formatCurrency(Number(lease.rentAmount));

    // PM notification (all thresholds)
    notify({
      userId: lease.landlordId,
      createdById: lease.landlordId,
      type: "LEASE_EXPIRING",
      title: `Lease Expiring in ${daysRemaining} Days`,
      message: `${lease.tenant.user.name} at ${propertyName} Unit ${unitNumber} — expires ${formattedEndDate}.`,
      severity,
      email: PM_EMAIL_THRESHOLDS.includes(applicableThreshold) && lease.landlord.email
        ? {
            to: lease.landlord.email,
            subject: `Lease Expiring: ${propertyName} Unit ${unitNumber} (${daysRemaining} days)`,
            html: leaseExpirationHtml({
              recipientName: lease.landlord.name,
              propertyName,
              unitNumber,
              endDate: formattedEndDate,
              daysRemaining,
              rentAmount: formattedRent,
              role: "pm",
            }),
          }
        : undefined,
    }).catch(console.error);

    // Tenant notification (30 and 14 day thresholds only)
    if (TENANT_THRESHOLDS.includes(applicableThreshold) && lease.tenant.user.email) {
      notify({
        userId: lease.tenant.user.id,
        createdById: lease.landlordId,
        type: "LEASE_EXPIRING",
        title: `Your Lease Expires in ${daysRemaining} Days`,
        message: `Your lease at ${propertyName} Unit ${unitNumber} expires on ${formattedEndDate}. Contact your property manager about renewal.`,
        severity,
        email: TENANT_EMAIL_THRESHOLDS.includes(applicableThreshold)
          ? {
              to: lease.tenant.user.email,
              subject: `Your Lease is Expiring Soon — ${propertyName}`,
              html: leaseExpirationHtml({
                recipientName: lease.tenant.user.name,
                propertyName,
                unitNumber,
                endDate: formattedEndDate,
                daysRemaining,
                rentAmount: formattedRent,
                role: "tenant",
              }),
            }
          : undefined,
      }).catch(console.error);
    }

    // Update deduplication tracker
    await db.lease.update({
      where: { id: lease.id },
      data: { lastAlertDays: applicableThreshold },
    });

    // Emit lease.expiring event
    emit({
      eventType: "lease.expiring",
      aggregateType: "Lease",
      aggregateId: lease.id,
      payload: { tenantId: lease.tenantId, daysUntilExpiry: applicableThreshold },
      emittedBy: "system",
    }).catch(console.error);

    alertsSent++;
  }

  return NextResponse.json({
    success: true,
    totalChecked: leases.length,
    alertsSent,
    expired,
    skipped,
  });
}

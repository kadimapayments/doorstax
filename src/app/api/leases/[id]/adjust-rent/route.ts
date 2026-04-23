export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveApiLandlord } from "@/lib/api-landlord";
import { auditLog } from "@/lib/audit";
import { sendRentAdjustmentEmail } from "@/lib/emails/rent-adjustment";
import { z } from "zod";

/**
 * POST /api/leases/[id]/adjust-rent
 *
 * Orchestrated rent change on a lease with full compliance + audit +
 * tenant notice. Replaces the "edit rent on the unit" path for
 * tenant-facing changes; listing rent (Unit.rentAmount on a vacant
 * unit) still moves via the unit PUT handler.
 *
 * What this does atomically:
 *   1. Updates Lease.rentAmount
 *   2. Updates Unit.rentAmount (keeps it in sync with the in-place rent)
 *   3. Writes a RentChangeHistory row (compliance + audit)
 *   4. Creates a LeaseAddendum (AMENDMENT) for legal continuity
 *   5. Syncs RecurringBilling.amount for every autopay-active tenant
 *
 * What this does outside the transaction:
 *   - Writes an AuditLog row (fire-and-forget)
 *   - Emails every active tenant on the unit (fire-and-forget)
 *
 * Auth: uses resolveApiLandlord so admin impersonation works — matches
 * the Unit PUT handler's existing pattern.
 */

const bodySchema = z.object({
  newAmount: z.coerce.number().positive("newAmount must be > 0"),
  effectiveDate: z.string().min(1, "effectiveDate is required"),
  reason: z.string().optional().nullable(),
  noticePeriodDays: z.coerce.number().int().min(0).max(365).optional().nullable(),
  complianceAck: z.boolean().refine((v) => v === true, {
    message: "You must acknowledge rent control compliance",
  }),
  complianceNote: z.string().optional().nullable(),
  jurisdiction: z.string().optional().nullable(),
});

// Advisory percentage caps per jurisdiction. Used to surface a warning,
// NOT to block the change — the PM is responsible via complianceAck.
const JURISDICTION_CAPS: Record<string, number> = {
  CA_AB1482: 10,
  LA_RSO: 3,
  NY_RENT_STABILIZED: 5.25,
  OR_STATEWIDE: 10,
  DC: 12,
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await resolveApiLandlord();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: leaseId } = await params;

  let data;
  try {
    data = bodySchema.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0].message, field: err.errors[0].path.join(".") },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const effective = new Date(data.effectiveDate);
  if (!Number.isFinite(effective.getTime())) {
    return NextResponse.json(
      { error: "Invalid effectiveDate" },
      { status: 400 }
    );
  }
  if (effective.getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "Effective date must be in the future" },
      { status: 400 }
    );
  }

  // Load the lease with everything we need — scoped to PM ownership.
  const lease = await db.lease.findFirst({
    where: { id: leaseId, landlordId: ctx.landlordId },
    include: {
      unit: {
        select: {
          id: true,
          unitNumber: true,
          property: {
            select: {
              id: true,
              name: true,
              landlordId: true,
              rentControlJurisdiction: true,
              rentControlMaxPercent: true,
            },
          },
          tenantProfiles: {
            where: { status: "ACTIVE" },
            select: {
              id: true,
              splitPercent: true,
              user: { select: { name: true, email: true } },
            },
          },
        },
      },
    },
  });

  if (!lease) {
    return NextResponse.json({ error: "Lease not found" }, { status: 404 });
  }

  const previousAmount = Number(lease.rentAmount);
  const newAmount = data.newAmount;
  const changePercent =
    previousAmount > 0
      ? ((newAmount - previousAmount) / previousAmount) * 100
      : 0;
  const changeType =
    newAmount > previousAmount
      ? "INCREASE"
      : newAmount < previousAmount
        ? "DECREASE"
        : "CORRECTION";

  // Advisory jurisdiction check — log a warning if the PM blew past a
  // documented cap. Their complianceAck still governs whether the
  // change is allowed; we don't block.
  const jurisdiction =
    lease.unit.property.rentControlJurisdiction ||
    data.jurisdiction ||
    "NONE";
  const customCap =
    jurisdiction === "CUSTOM"
      ? lease.unit.property.rentControlMaxPercent ?? null
      : null;
  const cap = customCap ?? JURISDICTION_CAPS[jurisdiction] ?? null;
  if (cap !== null && changeType === "INCREASE" && changePercent > cap) {
    console.warn(
      `[rent-adjust] Lease ${leaseId}: increase of ${changePercent.toFixed(
        1
      )}% exceeds ${jurisdiction} advisory cap of ${cap}%`
    );
  }

  // ── Transaction: 5 writes atomic ──
  const history = await db.$transaction(async (tx) => {
    await tx.lease.update({
      where: { id: leaseId },
      data: { rentAmount: newAmount },
    });

    await tx.unit.update({
      where: { id: lease.unit.id },
      data: { rentAmount: newAmount },
    });

    const historyRow = await tx.rentChangeHistory.create({
      data: {
        leaseId,
        unitId: lease.unit.id,
        tenantId: lease.unit.tenantProfiles[0]?.id ?? null,
        previousAmount,
        newAmount,
        changePercent,
        changeType,
        effectiveDate: effective,
        noticeDate: new Date(),
        noticePeriodDays: data.noticePeriodDays ?? null,
        jurisdiction,
        complianceAck: true,
        complianceNote: data.complianceNote ?? null,
        reason: data.reason ?? null,
        changedById: ctx.actorId,
      },
    });

    await tx.leaseAddendum.create({
      data: {
        leaseId,
        type: "AMENDMENT",
        newRentAmount: newAmount,
        notes:
          `Rent adjustment: ${previousAmount.toFixed(2)} → ` +
          `${newAmount.toFixed(2)} (${changePercent >= 0 ? "+" : ""}` +
          `${changePercent.toFixed(1)}%). Effective ${effective
            .toISOString()
            .slice(0, 10)}.${data.reason ? ` Reason: ${data.reason}.` : ""}`,
      },
    });

    // Sync RecurringBilling.amount for every autopay-active tenant on
    // the unit. Billing rows are unique per tenantProfile, so one
    // update per active TenantProfile at most.
    for (const tp of lease.unit.tenantProfiles) {
      const billing = await tx.recurringBilling.findUnique({
        where: { tenantId: tp.id },
      });
      if (billing && billing.status === "ACTIVE") {
        const splitPercent = tp.splitPercent ?? 100;
        const newBillingAmount = (newAmount * splitPercent) / 100;
        await tx.recurringBilling.update({
          where: { id: billing.id },
          data: { amount: newBillingAmount },
        });
      }
    }

    return historyRow;
  });

  // ── Side effects (fire-and-forget) ──
  auditLog({
    userId: ctx.actorId,
    userRole: ctx.actorRole,
    action: "RENT_ADJUSTMENT",
    objectType: "Lease",
    objectId: leaseId,
    description: `Rent changed from $${previousAmount.toFixed(2)} to $${newAmount.toFixed(
      2
    )} (${changeType} ${Math.abs(changePercent).toFixed(1)}%) effective ${effective
      .toISOString()
      .slice(0, 10)}`,
    oldValue: { rentAmount: previousAmount },
    newValue: {
      rentAmount: newAmount,
      reason: data.reason ?? null,
      jurisdiction,
    },
    req,
  });

  // Email each active tenant on the unit. PM info for the "contact
  // your PM" line at the bottom of the notice.
  const pm = await db.user.findUnique({
    where: { id: lease.landlordId },
    select: { name: true, email: true, companyName: true },
  });

  for (const tp of lease.unit.tenantProfiles) {
    if (tp.user?.email) {
      sendRentAdjustmentEmail(tp.user.email, {
        tenantName: tp.user.name || "Tenant",
        propertyName: lease.unit.property.name,
        unitNumber: lease.unit.unitNumber,
        previousAmount,
        newAmount,
        changePercent,
        effectiveDate: effective,
        reason: data.reason ?? null,
        pmName: pm?.companyName || pm?.name || null,
        pmEmail: pm?.email ?? null,
      }).catch(() => {}); // already swallows internally; belt-and-braces
    }
  }

  return NextResponse.json({
    success: true,
    history: {
      id: history.id,
      previousAmount,
      newAmount,
      changePercent,
      changeType,
      effectiveDate: effective,
      jurisdiction,
      advisoryCapExceeded:
        cap !== null && changeType === "INCREASE" && changePercent > cap,
    },
  });
}

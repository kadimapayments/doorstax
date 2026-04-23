import { db } from "@/lib/db";

/**
 * Single source of truth for "what rent are we charging this tenant?".
 *
 * Priority:
 *   1. Active Lease (status = ACTIVE | MONTH_TO_MONTH, endDate null
 *      or in the future) — the documented agreement.
 *   2. Unit.rentAmount — fallback for tenants without a formal lease
 *      (legacy data, mid-transfer states, direct-billed tenants).
 *
 * Always returns `effectiveAmount` with the tenant's `splitPercent`
 * already applied — callers should trust it as the charge amount.
 *
 * This helper is the ONLY place billing code should consult for
 * rent. The monthly charge cron, autopay charger, autopay
 * pre-reminder sync, and the PM virtual terminal all route through
 * it so the amount stays consistent across surfaces.
 */

export interface RentResolution {
  amount: number;           // Raw rent on the unit / lease, pre-split
  source: "LEASE" | "UNIT";
  leaseId?: string;
  unitId: string;
  splitPercent: number;
  effectiveAmount: number;  // amount * splitPercent / 100 — what to charge this tenant
}

/**
 * Resolve the current rent for a tenant profile.
 *
 * Returns `null` when the tenant has no unit assignment — caller
 * should treat as "skip" (no charge).
 */
export async function resolveRent(
  tenantId: string
): Promise<RentResolution | null> {
  const tenant = await db.tenantProfile.findUnique({
    where: { id: tenantId },
    select: {
      unitId: true,
      splitPercent: true,
      unit: { select: { id: true, rentAmount: true } },
      leases: {
        where: {
          status: { in: ["ACTIVE", "MONTH_TO_MONTH"] },
        },
        orderBy: { startDate: "desc" },
        take: 3, // room to skip stale rows in-JS
        select: { id: true, rentAmount: true, endDate: true, status: true },
      },
    },
  });

  if (!tenant || !tenant.unitId || !tenant.unit) return null;

  const splitPercent = tenant.splitPercent ?? 100;
  const now = Date.now();

  // Lease must either have no endDate (month-to-month) or an endDate
  // in the future. We also tolerate leases whose status is ACTIVE but
  // whose endDate has silently slipped into the past — common in the
  // real world when nobody's updated the record; treat them as stale
  // and fall through.
  const activeLease = tenant.leases.find(
    (l) => l.endDate === null || l.endDate.getTime() > now
  );

  if (activeLease && activeLease.rentAmount) {
    const amount = Number(activeLease.rentAmount);
    return {
      amount,
      source: "LEASE",
      leaseId: activeLease.id,
      unitId: tenant.unit.id,
      splitPercent,
      effectiveAmount: (amount * splitPercent) / 100,
    };
  }

  const amount = Number(tenant.unit.rentAmount);
  return {
    amount,
    source: "UNIT",
    unitId: tenant.unit.id,
    splitPercent,
    effectiveAmount: (amount * splitPercent) / 100,
  };
}

/**
 * Resolve the current rent for a unit (not scoped to a single tenant).
 * Used by code paths that iterate units directly — e.g. vacancy
 * projections, listing pages. Skips splitPercent because it's a
 * unit-level answer.
 */
export async function resolveRentForUnit(unitId: string): Promise<{
  amount: number;
  source: "LEASE" | "UNIT";
  leaseId?: string;
}> {
  const activeLease = await db.lease.findFirst({
    where: {
      unitId,
      status: { in: ["ACTIVE", "MONTH_TO_MONTH"] },
    },
    orderBy: { startDate: "desc" },
    select: { id: true, rentAmount: true, endDate: true },
  });

  if (
    activeLease &&
    activeLease.rentAmount &&
    (activeLease.endDate === null || activeLease.endDate.getTime() > Date.now())
  ) {
    return {
      amount: Number(activeLease.rentAmount),
      source: "LEASE",
      leaseId: activeLease.id,
    };
  }

  const unit = await db.unit.findUnique({
    where: { id: unitId },
    select: { rentAmount: true },
  });

  return {
    amount: Number(unit?.rentAmount || 0),
    source: "UNIT",
  };
}

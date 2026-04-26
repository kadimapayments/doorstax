"use client";

import { ChargeTenantForm } from "@/components/payments/charge-tenant-form";

/**
 * Virtual Terminal — Charge Tenant tab.
 *
 * Identical UX to the standalone /dashboard/payments/charge page. Both
 * render the shared `<ChargeTenantForm />` so behavior, validation,
 * method picker, and recovery-plan integration stay in lockstep. The
 * only difference between the two surfaces is the wrapper (this one
 * lives inside a tab strip with the Pay Vendor sibling).
 */
export function TenantChargeTab() {
  return (
    <ChargeTenantForm
      source="virtual-terminal"
      successHref="/dashboard/virtual-terminal"
    />
  );
}

"use client";

export const dynamic = "force-dynamic";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Building2, Wrench, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { AdminPmBillingTab } from "./_components/admin-pm-billing-tab";
import { AdminVendorPayoutTab } from "./_components/admin-vendor-payout-tab";

/**
 * Admin Virtual Terminal
 *
 * Two tools for DoorStax operators:
 *
 *  1. Bill PM/Landlord — settle outstanding BillingInvoice rows by
 *     charging a PM's saved DoorStax billing card. Uses the platform
 *     Kadima MID (NOT the PM's merchant account). This is DoorStax
 *     billing its own paying customers for SaaS / platform fees.
 *
 *  2. Pay vendor — send an ACH credit to a vendor on behalf of a PM.
 *
 * The legacy "Charge tenant" tab was retired in favor of (1). Tenant
 * rent collection is the PM's job; nothing here should ever run a
 * charge against a tenant. PMs collect tenant payments via
 * /dashboard/payments/charge under their own merchant credentials.
 */

function AdminVirtualTerminalContent() {
  const search = useSearchParams();
  // Back-compat: ?tab=vendor still selects the vendor-payout tab.
  // Anything else (including the old ?tab=tenant) defaults to billing.
  const initialTab = search.get("tab") === "vendor" ? "vendor" : "billing";
  const [tab, setTab] = useState<"billing" | "vendor">(initialTab);

  return (
    <div className="mx-auto max-w-4xl space-y-6 page-enter">
      <PageHeader
        title="Virtual Terminal"
        description="Bill PMs and landlords for platform fees, or send an ACH credit to a vendor on a PM's behalf."
      />

      {/* Safety notice — operator runs live transactions, audited under
          their account. The merchant of record differs by tab:
          • Bill PM/Landlord → DoorStax's platform MID
          • Pay vendor      → the selected PM's MID */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2">
        <ShieldAlert className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-amber-600">
            Admin action — high trust.
          </span>{" "}
          Every charge and payout here is a live transaction written to
          the audit log with your account.
        </div>
      </div>

      <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
        <button
          onClick={() => setTab("billing")}
          className={
            "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2 " +
            (tab === "billing"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          <Building2 className="h-4 w-4" />
          Bill PM/Landlord
        </button>
        <button
          onClick={() => setTab("vendor")}
          className={
            "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2 " +
            (tab === "vendor"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          <Wrench className="h-4 w-4" />
          Pay vendor
        </button>
      </div>

      {tab === "billing" ? <AdminPmBillingTab /> : <AdminVendorPayoutTab />}
    </div>
  );
}

export default function AdminVirtualTerminalPage() {
  return (
    <Suspense>
      <AdminVirtualTerminalContent />
    </Suspense>
  );
}

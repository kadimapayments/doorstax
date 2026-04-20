"use client";

export const dynamic = "force-dynamic";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CreditCard, Wrench, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { AdminTenantChargeTab } from "./_components/admin-tenant-charge-tab";
import { AdminVendorPayoutTab } from "./_components/admin-vendor-payout-tab";

function AdminVirtualTerminalContent() {
  const search = useSearchParams();
  const initialTab = search.get("tab") === "vendor" ? "vendor" : "tenant";
  const [tab, setTab] = useState<"tenant" | "vendor">(initialTab);

  return (
    <div className="mx-auto max-w-4xl space-y-6 page-enter">
      <PageHeader
        title="Virtual Terminal"
        description="Run a card charge on any tenant or send an ACH credit to any vendor — using the PM's merchant account as the merchant of record."
      />

      {/* Safety notice: admin VT runs real money against a PM's MID. */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2">
        <ShieldAlert className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-amber-600">
            Admin action — high trust.
          </span>{" "}
          Every charge and payout here runs under the selected PM&apos;s
          merchant credentials and is written to the audit log with your
          account.
        </div>
      </div>

      <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
        <button
          onClick={() => setTab("tenant")}
          className={
            "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2 " +
            (tab === "tenant"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          <CreditCard className="h-4 w-4" />
          Charge tenant
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

      {tab === "tenant" ? <AdminTenantChargeTab /> : <AdminVendorPayoutTab />}
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

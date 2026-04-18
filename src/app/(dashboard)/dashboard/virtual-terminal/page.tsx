"use client";

export const dynamic = "force-dynamic";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CreditCard, Wrench } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { TenantChargeTab } from "./_components/tenant-charge-tab";
import { VendorPayoutTab } from "./_components/vendor-payout-tab";

function VirtualTerminalContent() {
  const search = useSearchParams();
  const initialTab = search.get("tab") === "vendor" ? "vendor" : "tenant";
  const [tab, setTab] = useState<"tenant" | "vendor">(initialTab);

  return (
    <div className="mx-auto max-w-4xl space-y-6 page-enter">
      <PageHeader
        title="Virtual Terminal"
        description="Charge a tenant or send an ACH credit to a vendor — both from one place."
      />

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

      {tab === "tenant" ? <TenantChargeTab /> : <VendorPayoutTab />}
    </div>
  );
}

export default function VirtualTerminalPage() {
  return (
    <Suspense>
      <VirtualTerminalContent />
    </Suspense>
  );
}

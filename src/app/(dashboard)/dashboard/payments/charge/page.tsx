"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ChargeTenantForm } from "@/components/payments/charge-tenant-form";

/**
 * /dashboard/payments/charge — standalone Charge Tenant page.
 *
 * Identical UX to the VT tenant tab — both render the same shared
 * `<ChargeTenantForm />`. The only difference is the wrapper chrome:
 * this surface gets a page header + back link, the VT tab gets the
 * tab strip with the Pay Vendor sibling.
 */
export default function ChargeTenantPage() {
  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/payments"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Payments
      </Link>

      <PageHeader
        title="Charge Tenant"
        description="Card, ACH, cash, or check — and apply to an active recovery plan in one shot."
      />

      <Card>
        <CardHeader>
          <CardTitle>New Charge</CardTitle>
        </CardHeader>
        <CardContent>
          <ChargeTenantForm
            source="virtual-terminal"
            successHref="/dashboard/payments"
          />
        </CardContent>
      </Card>
    </div>
  );
}

export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth-utils";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Receipt } from "lucide-react";
import {
  RecordOfflinePaymentForm,
  type OfflinePaymentTenantOption,
} from "@/components/payments/record-offline-payment-form";

export const metadata = { title: "Record offline payment" };

/**
 * /dashboard/payments/record — PM-facing page for logging cash + check
 * receipts. Server-renders the active tenant list scoped to the PM's
 * portfolio, then hands off to the client form.
 */
export default async function RecordOfflinePaymentPage() {
  const user = await requireRole("PM");
  const landlordId = await getEffectiveLandlordId(user.id);

  const tenants = await db.tenantProfile.findMany({
    where: {
      status: "ACTIVE",
      unit: { property: { landlordId } },
    },
    select: {
      id: true,
      user: { select: { name: true, email: true } },
      unit: {
        select: {
          id: true,
          unitNumber: true,
          rentAmount: true,
          property: { select: { name: true } },
        },
      },
    },
    orderBy: [
      { unit: { property: { name: "asc" } } },
      { unit: { unitNumber: "asc" } },
    ],
  });

  const options: OfflinePaymentTenantOption[] = tenants
    .filter((t) => t.unit) // skip tenants with no unit assignment
    .map((t) => ({
      tenantId: t.id,
      // unitId is needed by /api/payments/charge for settle / auto-
      // allocate flows. The page filters out null-unit tenants above
      // so the non-null assertion is safe here.
      unitId: t.unit!.id,
      name: t.user?.name || "Unnamed tenant",
      email: t.user?.email ?? null,
      unitNumber: t.unit!.unitNumber,
      propertyName: t.unit!.property.name,
      rentAmount: Number(t.unit!.rentAmount || 0),
    }));

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Record offline payment"
        description="Log a cash or check receipt. The tenant's ledger is credited immediately and a branded receipt number is reserved for handoff."
      />

      <Card className="border-border">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
            <Receipt className="h-3.5 w-3.5" />
            <span>
              Cash and check payments don&apos;t flow through Kadima — they&apos;re
              recorded directly on the ledger here.
            </span>
          </div>
          <RecordOfflinePaymentForm tenants={options} />
        </CardContent>
      </Card>
    </div>
  );
}

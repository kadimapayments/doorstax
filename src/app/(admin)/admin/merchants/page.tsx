export const dynamic = "force-dynamic";

import { requireAdminPermission } from "@/lib/auth-utils";
import { PageHeader } from "@/components/ui/page-header";
import { MerchantsTable } from "@/components/admin/merchants-table";

export const metadata = { title: "Merchants — Admin" };

export default async function AdminMerchantsPage() {
  await requireAdminPermission("admin:landlords");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Merchants"
        description="Track every PM's merchant application status, expiry countdown, and onboarding progress."
      />
      <MerchantsTable />
    </div>
  );
}

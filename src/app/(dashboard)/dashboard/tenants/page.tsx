import Link from "next/link";
import { requireRole } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Users, UserPlus } from "lucide-react";
import { TenantTable } from "@/components/tenants/tenant-table";

export const metadata = { title: "Tenants" };

export default async function TenantsPage() {
  const user = await requireRole("LANDLORD");

  const tenants = await db.tenantProfile.findMany({
    where: {
      unit: { property: { landlordId: user.id } },
    },
    include: {
      user: { select: { name: true, email: true } },
      unit: {
        select: {
          unitNumber: true,
          rentAmount: true,
          property: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = tenants.map((t) => ({
    id: t.id,
    name: t.user.name,
    email: t.user.email,
    property: t.unit?.property.name || "—",
    unit: t.unit?.unitNumber || "—",
    rent: Number(t.unit?.rentAmount || 0),
    split: t.splitPercent,
    isPrimary: t.isPrimary,
    autopay: t.autopayEnabled,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenants"
        description="Manage tenants across your properties."
        actions={
          <div className="flex gap-2">
            <Link href="/dashboard/tenants/add">
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Add Tenant
              </Button>
            </Link>
            <Link href="/dashboard/tenants/invite">
              <Button variant="outline">
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Tenant
              </Button>
            </Link>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<Users className="h-12 w-12" />}
          title="No tenants yet"
          description="Add your first tenant or send an invite to get started."
          action={
            <div className="flex gap-2">
              <Link href="/dashboard/tenants/add">
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add Tenant
                </Button>
              </Link>
              <Link href="/dashboard/tenants/invite">
                <Button variant="outline">Invite Tenant</Button>
              </Link>
            </div>
          }
        />
      ) : (
        <TenantTable rows={rows} />
      )}
    </div>
  );
}

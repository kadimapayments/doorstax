import Link from "next/link";
import { requireRole } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency } from "@/lib/utils";
import { Users, UserPlus } from "lucide-react";

export const metadata = { title: "Tenants" };

interface TenantRow {
  id: string;
  name: string;
  email: string;
  property: string;
  unit: string;
  rent: number;
  autopay: boolean;
}

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

  const rows: TenantRow[] = tenants.map((t) => ({
    id: t.id,
    name: t.user.name,
    email: t.user.email,
    property: t.unit?.property.name || "—",
    unit: t.unit?.unitNumber || "—",
    rent: Number(t.unit?.rentAmount || 0),
    autopay: t.autopayEnabled,
  }));

  const columns: Column<TenantRow>[] = [
    { key: "name", header: "Name", cell: (row) => row.name },
    { key: "email", header: "Email", cell: (row) => <span className="text-muted-foreground">{row.email}</span> },
    { key: "property", header: "Property", cell: (row) => row.property },
    { key: "unit", header: "Unit", cell: (row) => row.unit },
    { key: "rent", header: "Rent", cell: (row) => formatCurrency(row.rent) },
    {
      key: "autopay",
      header: "Autopay",
      cell: (row) => <StatusBadge status={row.autopay ? "ACTIVE" : "PAUSED"} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenants"
        description="Manage tenants across your properties."
        actions={
          <Link href="/dashboard/tenants/invite">
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite Tenant
            </Button>
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<Users className="h-12 w-12" />}
          title="No tenants yet"
          description="Invite your first tenant to get started with rent collection."
          action={
            <Link href="/dashboard/tenants/invite">
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Tenant
              </Button>
            </Link>
          }
        />
      ) : (
        <DataTable columns={columns} data={rows} />
      )}
    </div>
  );
}

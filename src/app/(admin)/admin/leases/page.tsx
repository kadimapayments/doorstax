export const dynamic = "force-dynamic";

import { requireAdminPermission } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { LeasesTable } from "@/components/admin/leases-table";

export const metadata = { title: "Leases — Admin" };

export default async function AdminLeasesPage() {
  await requireAdminPermission("admin:leases");

  const leases = await db.lease.findMany({
    include: {
      tenant: { include: { user: { select: { name: true } } } },
      unit: { select: { unitNumber: true } },
      property: { select: { name: true } },
      landlord: { select: { id: true, name: true } },
      addendums: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = leases.map((l) => ({
    id: l.id,
    tenant: l.tenant.user.name,
    landlordId: l.landlord.id,
    landlordName: l.landlord.name,
    property: l.property.name,
    unit: l.unit.unitNumber,
    rent: Number(l.rentAmount),
    start: l.startDate.toISOString(),
    end: l.endDate.toISOString(),
    status: l.status,
    addendums: l.addendums.length,
  }));

  const landlords = Array.from(
    new Map(rows.map((r) => [r.landlordId, r.landlordName])).entries()
  ).map(([id, name]) => ({ id, name }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leases"
        description="All leases across the platform."
      />
      <LeasesTable rows={rows} landlords={landlords} />
    </div>
  );
}

export const dynamic = "force-dynamic";

import { requireAdminPermission } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { PropertiesTable } from "@/components/admin/properties-table";

export const metadata = { title: "Properties — Admin" };

export default async function AdminPropertiesPage() {
  await requireAdminPermission("admin:properties");

  const properties = await db.property.findMany({
    include: {
      landlord: { select: { id: true, name: true } },
      units: { select: { id: true, status: true, rentAmount: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = properties.map((p) => {
    const totalUnits = p.units.length;
    const occupiedUnits = p.units.filter((u) => u.status === "OCCUPIED").length;
    const avgRent =
      totalUnits > 0
        ? Math.round(
            p.units.reduce((s, u) => s + Number(u.rentAmount), 0) / totalUnits
          )
        : 0;

    return {
      id: p.id,
      name: p.name,
      landlordId: p.landlord.id,
      landlordName: p.landlord.name,
      address: p.address,
      city: p.city,
      state: p.state,
      zip: p.zip,
      propertyType: p.propertyType,
      totalUnits,
      occupiedUnits,
      avgRent,
    };
  });

  const landlords = Array.from(
    new Map(rows.map((r) => [r.landlordId, r.landlordName])).entries()
  ).map(([id, name]) => ({ id, name }));

  const cities = Array.from(new Set(rows.map((r) => r.city))).sort();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Properties"
        description="All properties across the platform."
      />
      <PropertiesTable rows={rows} landlords={landlords} cities={cities} />
    </div>
  );
}

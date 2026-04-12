export const dynamic = "force-dynamic";

import { requireAdminPermission } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { ListingsTable } from "@/components/admin/listings-table";

export const metadata = { title: "Listings — Admin" };

export default async function AdminListingsPage() {
  await requireAdminPermission("admin:properties");

  const units = await db.unit.findMany({
    include: {
      property: {
        select: {
          name: true,
          city: true,
          state: true,
          landlord: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { property: { name: "asc" } },
  });

  const rows = units.map((u) => ({
    id: u.id,
    propertyName: u.property.name,
    unitNumber: u.unitNumber,
    landlordId: u.property.landlord.id,
    landlordName: u.property.landlord.name,
    city: u.property.city,
    state: u.property.state,
    bedrooms: u.bedrooms ?? 0,
    rent: Number(u.rentAmount),
    status: u.status,
    listingEnabled: u.listingEnabled,
    applicationsEnabled: u.applicationsEnabled,
  }));

  const landlords = Array.from(
    new Map(rows.map((r) => [r.landlordId, r.landlordName])).entries()
  ).map(([id, name]) => ({ id, name }));

  const cities = Array.from(new Set(rows.map((r) => r.city))).sort();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Listings"
        description="All unit listings across the platform."
      />
      <ListingsTable rows={rows} landlords={landlords} cities={cities} />
    </div>
  );
}

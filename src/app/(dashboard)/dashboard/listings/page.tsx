import { requireRole } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { ListingTable } from "@/components/listings/listing-table";

export const metadata = { title: "Listings — DoorStax" };

export default async function ListingsPage() {
  const user = await requireRole("LANDLORD");

  const units = await db.unit.findMany({
    where: { property: { landlordId: user.id } },
    include: { property: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const rows = units.map((u) => ({
    id: u.id,
    propertyName: u.property.name,
    unitNumber: u.unitNumber,
    rent: Number(u.rentAmount),
    status: u.status,
    listingEnabled: u.listingEnabled,
    applicationsEnabled: u.applicationsEnabled,
    propertyId: u.property.id,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Listings"
        description="Manage which units are publicly listed and accepting applications."
      />
      <ListingTable rows={rows} />
    </div>
  );
}

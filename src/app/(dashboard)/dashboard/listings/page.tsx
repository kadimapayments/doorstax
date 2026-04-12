export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { PageHeader } from "@/components/ui/page-header";
import { ListingTable } from "@/components/listings/listing-table";
import type { PropertyType } from "@prisma/client";

export const metadata = { title: "Listings — DoorStax" };

const PAGE_SIZE = 25;

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; city?: string; propertyType?: string }>;
}) {
  const user = await requireRole("PM");
  const landlordId = await getEffectiveLandlordId(user.id);
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const cityFilter = params.city || "";
  const typeFilter = params.propertyType || "";

  // Build where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { property: { landlordId } };
  if (cityFilter) {
    where.property.city = cityFilter;
  }
  if (typeFilter) {
    where.property.propertyType = typeFilter as PropertyType;
  }

  // Fetch paginated data + total count + distinct cities in parallel
  const [units, totalCount, citiesRaw] = await Promise.all([
    db.unit.findMany({
      where,
      include: {
        property: {
          select: { id: true, name: true, city: true, propertyType: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.unit.count({ where }),
    db.property.findMany({
      where: { landlordId },
      select: { city: true },
      distinct: ["city"],
      orderBy: { city: "asc" },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const cities = citiesRaw.map((p) => p.city).filter((c) => c && c.trim() !== "");

  const rows = units.map((u) => ({
    id: u.id,
    propertyName: u.property.name,
    unitNumber: u.unitNumber,
    rent: Number(u.rentAmount),
    status: u.status,
    listingEnabled: u.listingEnabled,
    applicationsEnabled: u.applicationsEnabled,
    propertyId: u.property.id,
    city: u.property.city || "",
    propertyType: u.property.propertyType || "",
    bedrooms: u.bedrooms,
    bathrooms: u.bathrooms,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Listings"
        description="Manage which units are publicly listed and accepting applications."
      />
      <ListingTable
        rows={rows}
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        cities={cities}
        currentCity={cityFilter}
        currentPropertyType={typeFilter}
      />
    </div>
  );
}

import { requireRole } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

export const metadata = { title: "Listings — DoorStax" };

interface ListingRow {
  id: string;
  propertyName: string;
  unitNumber: string;
  rent: number;
  status: string;
  listingEnabled: boolean;
  applicationsEnabled: boolean;
  propertyId: string;
}

export default async function ListingsPage() {
  const user = await requireRole("LANDLORD");

  const units = await db.unit.findMany({
    where: { property: { landlordId: user.id } },
    include: { property: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const rows: ListingRow[] = units.map((u) => ({
    id: u.id,
    propertyName: u.property.name,
    unitNumber: u.unitNumber,
    rent: Number(u.rentAmount),
    status: u.status,
    listingEnabled: u.listingEnabled,
    applicationsEnabled: u.applicationsEnabled,
    propertyId: u.property.id,
  }));

  const columns: Column<ListingRow>[] = [
    {
      key: "unit",
      header: "Unit",
      cell: (row) => (
        <Link
          href={`/dashboard/properties/${row.propertyId}/units/${row.id}`}
          className="font-medium text-accent-lavender hover:underline"
        >
          {row.propertyName} — {row.unitNumber}
        </Link>
      ),
    },
    { key: "rent", header: "Rent", cell: (row) => formatCurrency(row.rent) },
    {
      key: "status",
      header: "Occupancy",
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "listing",
      header: "Listed",
      cell: (row) => (
        <span className={row.listingEnabled ? "text-green-400" : "text-text-muted"}>
          {row.listingEnabled ? "Yes" : "No"}
        </span>
      ),
    },
    {
      key: "applications",
      header: "Applications",
      cell: (row) => (
        <span className={row.applicationsEnabled ? "text-green-400" : "text-text-muted"}>
          {row.applicationsEnabled ? "Open" : "Closed"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Listings"
        description="Manage which units are publicly listed and accepting applications."
      />
      <DataTable columns={columns} data={rows} emptyMessage="No units yet. Add a property first." />
    </div>
  );
}

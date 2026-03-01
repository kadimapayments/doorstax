"use client";

import Link from "next/link";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency } from "@/lib/utils";

export interface ListingRow {
  id: string;
  propertyName: string;
  unitNumber: string;
  rent: number;
  status: string;
  listingEnabled: boolean;
  applicationsEnabled: boolean;
  propertyId: string;
}

export function ListingTable({ rows }: { rows: ListingRow[] }) {
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
    {
      key: "rent",
      header: "Rent",
      cell: (row) => formatCurrency(row.rent),
    },
    {
      key: "status",
      header: "Occupancy",
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "listing",
      header: "Listed",
      cell: (row) => (
        <span
          className={
            row.listingEnabled ? "text-green-400" : "text-text-muted"
          }
        >
          {row.listingEnabled ? "Yes" : "No"}
        </span>
      ),
    },
    {
      key: "applications",
      header: "Applications",
      cell: (row) => (
        <span
          className={
            row.applicationsEnabled ? "text-green-400" : "text-text-muted"
          }
        >
          {row.applicationsEnabled ? "Open" : "Closed"}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      emptyMessage="No units yet. Add a property first."
    />
  );
}

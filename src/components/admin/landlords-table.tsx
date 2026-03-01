"use client";

import { DataTable, type Column } from "@/components/ui/data-table";
import { formatCurrency, formatDate } from "@/lib/utils";

export interface LandlordRow {
  id: string;
  name: string;
  email: string;
  properties: number;
  units: number;
  volume: number;
  createdAt: string; // serialized date
}

export function LandlordsTable({ rows }: { rows: LandlordRow[] }) {
  const columns: Column<LandlordRow>[] = [
    {
      key: "name",
      header: "Name",
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: "email",
      header: "Email",
      cell: (row) => (
        <span className="text-muted-foreground">{row.email}</span>
      ),
    },
    { key: "properties", header: "Properties", cell: (row) => row.properties },
    { key: "units", header: "Units", cell: (row) => row.units },
    {
      key: "volume",
      header: "Volume",
      cell: (row) => formatCurrency(row.volume),
    },
    {
      key: "joined",
      header: "Joined",
      cell: (row) => formatDate(new Date(row.createdAt)),
    },
  ];

  return (
    <DataTable columns={columns} data={rows} emptyMessage="No landlords yet." />
  );
}

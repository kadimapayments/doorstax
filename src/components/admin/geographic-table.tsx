"use client";

import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

export interface GeoRow {
  state: string;
  city: string;
  properties: number;
  units: number;
  occupiedUnits: number;
  occupancyRate: number;
  avgRent: number;
  volume: number;
  failureRate: number;
  cardPercent: number;
  status: "hot" | "normal" | "suffering";
}

const statusStyles = {
  hot: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
  normal: "bg-blue-500/15 text-blue-500 border-blue-500/20",
  suffering: "bg-destructive/15 text-destructive border-destructive/20",
};

const statusLabels = {
  hot: "Hot",
  normal: "Normal",
  suffering: "Suffering",
};

const columns: Column<GeoRow>[] = [
  { key: "state", header: "State", cell: (row) => <span className="font-medium">{row.state}</span> },
  { key: "city", header: "City", cell: (row) => row.city },
  { key: "properties", header: "Properties", cell: (row) => row.properties },
  { key: "units", header: "Units", cell: (row) => `${row.occupiedUnits}/${row.units}` },
  { key: "occupancy", header: "Occupancy", cell: (row) => `${row.occupancyRate}%` },
  { key: "avgRent", header: "Avg Rent", cell: (row) => formatCurrency(row.avgRent) },
  { key: "volume", header: "Volume", cell: (row) => formatCurrency(row.volume) },
  { key: "cardPercent", header: "Card %", cell: (row) => `${row.cardPercent}%` },
  { key: "failureRate", header: "Failure %", cell: (row) => `${row.failureRate}%` },
  {
    key: "status",
    header: "Status",
    cell: (row) => (
      <Badge variant="outline" className={cn("font-medium", statusStyles[row.status])}>
        {statusLabels[row.status]}
      </Badge>
    ),
  },
];

export function GeographicTable({ rows }: { rows: GeoRow[] }) {
  return <DataTable columns={columns} data={rows} emptyMessage="No geographic data yet." />;
}

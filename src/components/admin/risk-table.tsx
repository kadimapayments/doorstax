"use client";

import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";

export interface RiskRow {
  id: string;
  landlord: string;
  tenant: string;
  unit: string;
  amount: number;
  status: string;
  date: string; // serialized date
}

export function RiskTable({ rows }: { rows: RiskRow[] }) {
  const columns: Column<RiskRow>[] = [
    { key: "landlord", header: "Landlord", cell: (row) => row.landlord },
    { key: "tenant", header: "Tenant", cell: (row) => row.tenant },
    { key: "unit", header: "Unit", cell: (row) => row.unit },
    {
      key: "amount",
      header: "Amount",
      cell: (row) => formatCurrency(row.amount),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "date",
      header: "Date",
      cell: (row) => formatDate(new Date(row.date)),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      emptyMessage="No flagged transactions."
    />
  );
}

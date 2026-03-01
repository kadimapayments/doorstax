"use client";

import { DataTable, type Column } from "@/components/ui/data-table";
import { formatCurrency } from "@/lib/utils";

export interface MonthRow {
  month: string;
  ach: number;
  card: number;
  total: number;
  count: number;
}

export function VolumeTable({ rows }: { rows: MonthRow[] }) {
  const columns: Column<MonthRow>[] = [
    {
      key: "month",
      header: "Month",
      cell: (row) => <span className="font-medium">{row.month}</span>,
    },
    {
      key: "ach",
      header: "ACH",
      cell: (row) => formatCurrency(row.ach),
    },
    {
      key: "card",
      header: "Card",
      cell: (row) => formatCurrency(row.card),
    },
    {
      key: "total",
      header: "Total",
      cell: (row) => (
        <span className="font-semibold">{formatCurrency(row.total)}</span>
      ),
    },
    {
      key: "count",
      header: "Transactions",
      cell: (row) => row.count,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      emptyMessage="No completed payments yet."
    />
  );
}

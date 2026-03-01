"use client";

import Link from "next/link";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";

export interface AppRow {
  id: string;
  name: string;
  email: string;
  property: string;
  unit: string;
  income: number;
  status: string;
  createdAt: string; // serialized date
}

export function ApplicationTable({ rows }: { rows: AppRow[] }) {
  const columns: Column<AppRow>[] = [
    {
      key: "name",
      header: "Applicant",
      cell: (row) => (
        <Link
          href={`/dashboard/applications/${row.id}`}
          className="font-medium hover:underline"
        >
          {row.name}
        </Link>
      ),
    },
    {
      key: "email",
      header: "Email",
      cell: (row) => (
        <span className="text-muted-foreground">{row.email}</span>
      ),
    },
    { key: "property", header: "Property", cell: (row) => row.property },
    { key: "unit", header: "Unit", cell: (row) => row.unit },
    {
      key: "income",
      header: "Income",
      cell: (row) => formatCurrency(row.income),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "date",
      header: "Date",
      cell: (row) => formatDate(new Date(row.createdAt)),
    },
  ];

  return <DataTable columns={columns} data={rows} />;
}

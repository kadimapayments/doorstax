"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { formatCurrency } from "@/lib/utils";
import { UsersRound, Search } from "lucide-react";
import { ViewAsButton } from "@/components/tenants/view-as-button";

export interface TenantRow {
  id: string;
  name: string;
  email: string;
  property: string;
  unit: string;
  rent: number;
  split: number;
  isPrimary: boolean;
  autopay: boolean;
}

export function TenantTable({ rows }: { rows: TenantRow[] }) {
  const [search, setSearch] = useState("");

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.property.toLowerCase().includes(q) ||
      r.unit.toLowerCase().includes(q)
    );
  });

  const columns: Column<TenantRow>[] = [
    {
      key: "name",
      header: "Name",
      cell: (row) => (
        <div>
          <span className="font-medium">{row.name}</span>
          {!row.isPrimary && (
            <span className="ml-2 text-xs text-muted-foreground">(Roommate)</span>
          )}
        </div>
      ),
    },
    { key: "email", header: "Email", cell: (row) => <span className="text-muted-foreground">{row.email}</span> },
    { key: "property", header: "Property", cell: (row) => row.property },
    { key: "unit", header: "Unit", cell: (row) => row.unit },
    {
      key: "rent",
      header: "Rent / Split",
      cell: (row) => (
        <div>
          <span>{formatCurrency(row.rent * row.split / 100)}</span>
          {row.split < 100 && (
            <span className="ml-1 text-xs text-muted-foreground">({row.split}%)</span>
          )}
        </div>
      ),
    },
    {
      key: "autopay",
      header: "Autopay",
      cell: (row) => <StatusBadge status={row.autopay ? "ACTIVE" : "PAUSED"} />,
    },
    {
      key: "actions",
      header: "",
      cell: (row) => (
        <div className="flex gap-1">
          <ViewAsButton tenantId={row.id} />
          <Link href={`/dashboard/tenants/${row.id}/roommates`}>
            <Button variant="ghost" size="sm">
              <UsersRound className="mr-1 h-3 w-3" />
              Roommates
            </Button>
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search tenants..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      <DataTable columns={columns} data={filtered} />
    </div>
  );
}

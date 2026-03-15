"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { Search, CheckCircle2, XCircle } from "lucide-react";

interface UnitRow {
  id: string;
  unitNumber: string;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  rent: number;
  status: string;
  tenantName: string | null;
  tenantEmail: string | null;
  listingEnabled: boolean;
  applicationsEnabled: boolean;
}

const statusFilters = ["ALL", "OCCUPIED", "AVAILABLE"] as const;

export function PropertyUnitsTable({ rows }: { rows: UnitRow[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const filtered = rows.filter((r) => {
    const matchesSearch =
      !search ||
      r.unitNumber.toLowerCase().includes(search.toLowerCase()) ||
      (r.tenantName && r.tenantName.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus =
      statusFilter === "ALL" || r.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by unit or tenant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-border p-1">
          {statusFilters.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <span className="text-sm text-muted-foreground">
          {filtered.length} unit{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="rounded-lg border border-border card-glow">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Unit #</TableHead>
              <TableHead className="text-right">Bed</TableHead>
              <TableHead className="text-right">Bath</TableHead>
              <TableHead className="text-right">Sqft</TableHead>
              <TableHead className="text-right">Rent</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead className="text-center">Listed</TableHead>
              <TableHead className="text-center">Apps</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  No units match your search.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id} className="border-border">
                  <TableCell className="font-medium">{row.unitNumber}</TableCell>
                  <TableCell className="text-right">{row.bedrooms ?? "—"}</TableCell>
                  <TableCell className="text-right">{row.bathrooms ?? "—"}</TableCell>
                  <TableCell className="text-right">{row.sqft ?? "—"}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.rent)}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        row.status === "OCCUPIED"
                          ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/20"
                          : "bg-blue-500/15 text-blue-500 border-blue-500/20"
                      }
                    >
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {row.tenantName ? (
                      <div>
                        <p className="font-medium">{row.tenantName}</p>
                        <p className="text-xs text-muted-foreground">{row.tenantEmail}</p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {row.listingEnabled ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {row.applicationsEnabled ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

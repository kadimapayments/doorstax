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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Search } from "lucide-react";

interface LeaseRow {
  id: string;
  tenant: string;
  landlordId: string;
  landlordName: string;
  property: string;
  unit: string;
  rent: number;
  start: string;
  end: string;
  status: string;
  addendums: number;
}

interface LeasesTableProps {
  rows: LeaseRow[];
  landlords: { id: string; name: string }[];
}

const statusOptions = ["ALL", "ACTIVE", "EXPIRED", "TERMINATED", "RENEWED"];

const statusStyles: Record<string, string> = {
  ACTIVE: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
  EXPIRED: "bg-muted text-muted-foreground",
  TERMINATED: "bg-destructive/15 text-destructive border-destructive/20",
  RENEWED: "bg-blue-500/15 text-blue-500 border-blue-500/20",
};

export function LeasesTable({ rows, landlords }: LeasesTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [landlordFilter, setLandlordFilter] = useState("ALL");

  const filtered = rows.filter((r) => {
    if (search && !r.tenant.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
    if (landlordFilter !== "ALL" && r.landlordId !== landlordFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by tenant name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={landlordFilter}
          onChange={(e) => setLandlordFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="ALL">All Managers</option>
          {landlords.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <div className="flex gap-1">
          {statusOptions.map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(s)}
            >
              {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
            </Button>
          ))}
        </div>
        <span className="text-sm text-muted-foreground">
          {filtered.length} lease{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="rounded-lg border border-border card-glow">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Tenant</TableHead>
              <TableHead>Landlord</TableHead>
              <TableHead>Property</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Rent</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Addendums</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  No leases match your filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id} className="border-border">
                  <TableCell className="font-medium">{row.tenant}</TableCell>
                  <TableCell>{row.landlordName}</TableCell>
                  <TableCell>{row.property}</TableCell>
                  <TableCell>{row.unit}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.rent)}</TableCell>
                  <TableCell>{formatDate(row.start)}</TableCell>
                  <TableCell>{formatDate(row.end)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusStyles[row.status] || ""}>
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {row.addendums > 0 ? row.addendums : "\u2014"}
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

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
import { formatCurrency } from "@/lib/utils";
import { Search } from "lucide-react";
import { ViewAsButton } from "@/components/tenants/view-as-button";

interface TenantRow {
  id: string;
  userId: string;
  name: string;
  email: string;
  property: string;
  unit: string;
  rent: number;
  status: string;
  landlordId: string;
  landlordName: string;
  autopayEnabled: boolean;
}

interface TenantsTableProps {
  rows: TenantRow[];
  landlords: { id: string; name: string }[];
}

const statusOptions = ["ALL", "ACTIVE", "PREVIOUS", "PROSPECT"];

export function TenantsTable({ rows, landlords }: TenantsTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [landlordFilter, setLandlordFilter] = useState("ALL");

  const filtered = rows.filter((r) => {
    if (search) {
      const q = search.toLowerCase();
      if (!r.name.toLowerCase().includes(q) && !r.email.toLowerCase().includes(q)) return false;
    }
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
            placeholder="Search by name or email..."
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
          {filtered.length} tenant{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="rounded-lg border border-border card-glow">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Landlord</TableHead>
              <TableHead>Property</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Rent</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Autopay</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  No tenants match your filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id} className="border-border">
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-muted-foreground">{row.email}</TableCell>
                  <TableCell>{row.landlordName}</TableCell>
                  <TableCell>{row.property}</TableCell>
                  <TableCell>{row.unit}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.rent)}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        row.status === "ACTIVE"
                          ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/20"
                          : row.status === "PREVIOUS"
                          ? "bg-muted text-muted-foreground"
                          : "bg-blue-500/15 text-blue-500 border-blue-500/20"
                      }
                    >
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {row.autopayEnabled ? (
                      <Badge variant="outline" className="bg-emerald-500/15 text-emerald-500 border-emerald-500/20">ON</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">OFF</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <ViewAsButton tenantId={row.id} />
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

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
import { formatDate } from "@/lib/utils";
import { Search } from "lucide-react";

interface ApplicationRow {
  id: string;
  applicant: string;
  email: string;
  phone: string;
  property: string;
  unit: string;
  landlordId: string;
  landlordName: string;
  status: string;
  date: string;
}

interface ApplicationsTableProps {
  rows: ApplicationRow[];
  landlords: { id: string; name: string }[];
}

const statusOptions = ["ALL", "PENDING", "APPROVED", "DENIED", "WITHDRAWN"];

const statusStyles: Record<string, string> = {
  PENDING: "bg-amber-500/15 text-amber-500 border-amber-500/20",
  APPROVED: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
  DENIED: "bg-destructive/15 text-destructive border-destructive/20",
  WITHDRAWN: "bg-muted text-muted-foreground",
};

export function ApplicationsTable({ rows, landlords }: ApplicationsTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [landlordFilter, setLandlordFilter] = useState("ALL");

  const filtered = rows.filter((r) => {
    if (search) {
      const q = search.toLowerCase();
      if (!r.applicant.toLowerCase().includes(q) && !r.email.toLowerCase().includes(q)) return false;
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
            placeholder="Search by applicant name or email..."
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
          {filtered.length} application{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="rounded-lg border border-border card-glow">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Applicant</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Landlord</TableHead>
              <TableHead>Property / Unit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No applications match your filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id} className="border-border">
                  <TableCell className="font-medium">{row.applicant}</TableCell>
                  <TableCell className="text-muted-foreground">{row.email}</TableCell>
                  <TableCell>{row.landlordName}</TableCell>
                  <TableCell>{row.property} — {row.unit}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusStyles[row.status] || ""}>
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(row.date)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

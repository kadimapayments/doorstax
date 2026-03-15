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

interface TicketRow {
  id: string;
  title: string;
  description: string;
  submitter: string;
  landlordId: string;
  landlordName: string;
  property: string;
  unit: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
}

interface TicketsTableProps {
  rows: TicketRow[];
  landlords: { id: string; name: string }[];
}

const statusOptions = ["ALL", "OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
const priorityOptions = ["ALL", "HIGH", "MEDIUM", "LOW"];

const priorityStyles: Record<string, string> = {
  HIGH: "bg-destructive/15 text-destructive border-destructive/20",
  MEDIUM: "bg-amber-500/15 text-amber-500 border-amber-500/20",
  LOW: "bg-blue-500/15 text-blue-500 border-blue-500/20",
};

const statusStyles: Record<string, string> = {
  OPEN: "bg-blue-500/15 text-blue-500 border-blue-500/20",
  IN_PROGRESS: "bg-amber-500/15 text-amber-500 border-amber-500/20",
  RESOLVED: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
  CLOSED: "bg-muted text-muted-foreground",
};

export function TicketsTable({ rows, landlords }: TicketsTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [landlordFilter, setLandlordFilter] = useState("ALL");

  const filtered = rows.filter((r) => {
    if (search) {
      const q = search.toLowerCase();
      if (!r.title.toLowerCase().includes(q) && !r.submitter.toLowerCase().includes(q)) return false;
    }
    if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
    if (priorityFilter !== "ALL" && r.priority !== priorityFilter) return false;
    if (landlordFilter !== "ALL" && r.landlordId !== landlordFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by title or submitter..."
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
              className="text-xs"
            >
              {s === "ALL" ? "All" : s.replace("_", " ").charAt(0) + s.replace("_", " ").slice(1).toLowerCase()}
            </Button>
          ))}
        </div>
        <div className="flex gap-1">
          {priorityOptions.map((p) => (
            <Button
              key={p}
              variant={priorityFilter === p ? "default" : "outline"}
              size="sm"
              onClick={() => setPriorityFilter(p)}
              className="text-xs"
            >
              {p === "ALL" ? "Priority" : p}
            </Button>
          ))}
        </div>
        <span className="text-sm text-muted-foreground">
          {filtered.length} ticket{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="rounded-lg border border-border card-glow">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Title</TableHead>
              <TableHead>Submitter</TableHead>
              <TableHead>Landlord</TableHead>
              <TableHead>Property</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No tickets match your filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id} className="border-border">
                  <TableCell className="font-medium max-w-[250px] truncate">{row.title}</TableCell>
                  <TableCell>{row.submitter}</TableCell>
                  <TableCell>{row.landlordName}</TableCell>
                  <TableCell>{row.property} — {row.unit}</TableCell>
                  <TableCell>
                    <span className="capitalize text-sm">{row.category.toLowerCase().replace("_", " ")}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={priorityStyles[row.priority] || ""}>
                      {row.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusStyles[row.status] || ""}>
                      {row.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(row.createdAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

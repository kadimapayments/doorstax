"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatPhoneNumber } from "@/components/ui/phone-input";
import { toast } from "sonner";
import {
  Search,
  MoreHorizontal,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  UserPlus,
  Trash2,
  RefreshCw,
} from "lucide-react";
import type { Lead, StaffUser } from "./lead-card";

const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "APPLIED",
  "UNDERWRITING",
  "ONBOARDING",
  "CONVERTED",
  "LOST",
];

const sourceLabels: Record<string, string> = {
  WEBSITE: "Website",
  REFERRAL: "Referral",
  AGENT: "Agent",
  MANUAL: "Manual",
};

interface LeadsTableProps {
  leads: Lead[];
  staff: StaffUser[];
  onRowClick: (lead: Lead) => void;
  onLeadUpdate: (lead: Lead) => void;
  onLeadDelete: (leadId: string) => void;
}

export function LeadsTable({
  leads,
  staff,
  onRowClick,
  onLeadUpdate,
  onLeadDelete,
}: LeadsTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function handleSort(key: string) {
    if (sortCol === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(key);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(() => {
    let result = leads;

    if (statusFilter !== "ALL") {
      result = result.filter((l) => l.status === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q) ||
          l.companyName.toLowerCase().includes(q) ||
          l.phone.includes(q)
      );
    }

    if (sortCol) {
      result = [...result].sort((a, b) => {
        const aVal = (a as unknown as Record<string, unknown>)[sortCol];
        const bVal = (b as unknown as Record<string, unknown>)[sortCol];
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        if (typeof aVal === "number" && typeof bVal === "number") {
          return sortDir === "asc" ? aVal - bVal : bVal - aVal;
        }
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        return sortDir === "asc"
          ? aStr.localeCompare(bStr)
          : bStr.localeCompare(aStr);
      });
    }

    return result;
  }, [leads, search, statusFilter, sortCol, sortDir]);

  function SortIcon({ col }: { col: string }) {
    if (sortCol !== col) return <ArrowUpDown className="h-3.5 w-3.5 opacity-30" />;
    return sortDir === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5" />
    );
  }

  async function handleStatusChange(lead: Lead, newStatus: string) {
    const updated = { ...lead, status: newStatus };
    onLeadUpdate(updated);

    try {
      const res = await fetch(`/api/admin/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Status updated to ${newStatus}`);
    } catch {
      onLeadUpdate(lead);
      toast.error("Failed to update status");
    }
  }

  async function handleAssign(lead: Lead, userId: string) {
    const staffMember = staff.find((s) => s.id === userId);
    const updated = {
      ...lead,
      assignedToId: userId,
      assignedTo: staffMember ? { id: staffMember.id, name: staffMember.name } : null,
    };
    onLeadUpdate(updated);

    try {
      const res = await fetch(`/api/admin/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToId: userId }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Assigned to ${staffMember?.name || "staff member"}`);
    } catch {
      onLeadUpdate(lead);
      toast.error("Failed to assign lead");
    }
  }

  async function handleDelete(leadId: string) {
    try {
      const res = await fetch(`/api/admin/leads/${leadId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      onLeadDelete(leadId);
      toast.success("Lead deleted");
    } catch {
      toast.error("Failed to delete lead");
    }
  }

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="ALL">All Statuses</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border card-glow">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead
                className="cursor-pointer select-none hover:text-foreground"
                onClick={() => handleSort("name")}
              >
                <span className="inline-flex items-center gap-1">
                  Name <SortIcon col="name" />
                </span>
              </TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead
                className="cursor-pointer select-none text-right hover:text-foreground"
                onClick={() => handleSort("buildings")}
              >
                <span className="inline-flex items-center gap-1">
                  Buildings <SortIcon col="buildings" />
                </span>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none text-right hover:text-foreground"
                onClick={() => handleSort("units")}
              >
                <span className="inline-flex items-center gap-1">
                  Units <SortIcon col="units" />
                </span>
              </TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned</TableHead>
              <TableHead
                className="cursor-pointer select-none hover:text-foreground"
                onClick={() => handleSort("createdAt")}
              >
                <span className="inline-flex items-center gap-1">
                  Created <SortIcon col="createdAt" />
                </span>
              </TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={11}
                  className="h-24 text-center text-muted-foreground"
                >
                  No leads found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((lead) => (
                <TableRow
                  key={lead.id}
                  className="cursor-pointer border-border hover:bg-muted/50"
                  onClick={() => onRowClick(lead)}
                  role="button"
                >
                  <TableCell className="font-medium">{lead.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {lead.companyName || "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {lead.email}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {lead.phone ? formatPhoneNumber(lead.phone) : "-"}
                  </TableCell>
                  <TableCell className="text-right">{lead.buildings}</TableCell>
                  <TableCell className="text-right">{lead.units}</TableCell>
                  <TableCell>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {sourceLabels[lead.source] || lead.source}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={lead.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {lead.assignedTo?.name || (
                      <span className="text-xs italic">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(lead.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onRowClick(lead);
                          }}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        {/* Change Status submenu items */}
                        {LEAD_STATUSES.filter((s) => s !== lead.status).map(
                          (s) => (
                            <DropdownMenuItem
                              key={s}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(lead, s);
                              }}
                            >
                              <RefreshCw className="mr-2 h-4 w-4" />
                              {s.charAt(0) + s.slice(1).toLowerCase()}
                            </DropdownMenuItem>
                          )
                        )}

                        <DropdownMenuSeparator />

                        {/* Assign submenu items */}
                        {staff.map((s) => (
                          <DropdownMenuItem
                            key={s.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAssign(lead, s.id);
                            }}
                          >
                            <UserPlus className="mr-2 h-4 w-4" />
                            Assign to {s.name}
                          </DropdownMenuItem>
                        ))}

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(lead.id);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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

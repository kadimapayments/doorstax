"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SortableHeader, toggleSort, sortCompare, type SortDir } from "@/components/ui/sortable-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/ui/page-header";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Search,
  ChevronDown,
  ChevronUp,
  FileText,
  Download,
  ExternalLink,
} from "lucide-react";
import { PaginationControls } from "@/components/ui/pagination-controls";

interface LeaseAddendum {
  id: string;
  type: string;
  newRentAmount?: string | number | null;
  newEndDate?: string | null;
  notes?: string | null;
  documentUrl?: string | null;
  createdAt: string;
}

interface LeaseRow {
  id: string;
  rentAmount: string | number;
  startDate: string;
  endDate: string;
  status: string;
  documentUrl?: string | null;
  notes?: string | null;
  tenant: { user: { name: string; email?: string } };
  unit: { unitNumber: string; property: { name: string } };
  addendums: LeaseAddendum[];
  _count: { addendums: number };
}

const statuses = ["All", "PENDING", "ACTIVE", "EXPIRED", "TERMINATED", "RENEWED"];

export default function LeasesPage() {
  const [leases, setLeases] = useState<LeaseRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: string) {
    const s = toggleSort(key, sortCol, sortDir);
    setSortCol(s.sort);
    setSortDir(s.dir);
  }

  useEffect(() => {
    fetch("/api/leases")
      .then((r) => r.json())
      .then((data) => setLeases(Array.isArray(data) ? data : []));
  }, []);

  const toggleExpanded = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const filtered = leases.filter((l) => {
    if (statusFilter !== "All" && l.status !== statusFilter) return false;
    if (searchQuery) {
      const name = l.tenant?.user?.name || "";
      if (!name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    }
    return true;
  });

  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    return [...filtered].sort((a, b) => {
      let aVal: unknown, bVal: unknown;
      switch (sortCol) {
        case "tenantName":
          aVal = a.tenant?.user?.name || "";
          bVal = b.tenant?.user?.name || "";
          break;
        case "property":
          aVal = (a.unit?.property?.name || "") + " " + (a.unit?.unitNumber || "");
          bVal = (b.unit?.property?.name || "") + " " + (b.unit?.unitNumber || "");
          break;
        case "startDate":
          aVal = new Date(a.startDate).getTime();
          bVal = new Date(b.startDate).getTime();
          break;
        case "rentAmount":
          aVal = Number(a.rentAmount);
          bVal = Number(b.rentAmount);
          break;
        case "status":
          aVal = a.status;
          bVal = b.status;
          break;
        default:
          return 0;
      }
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === "number" && typeof bVal === "number")
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return sortDir === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [filtered, sortCol, sortDir]);

  const columnCount = 7; // chevron + tenant + property + rent + start + end + status

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leases"
        description="Manage lease agreements for all your properties."
        actions={
          <Link href="/dashboard/leases/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Lease
            </Button>
          </Link>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by tenant name..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); setExpandedId(null); }}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {statuses.map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => { setStatusFilter(s); setPage(1); setExpandedId(null); }}
            >
              {s === "All" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border card-glow">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="w-10" />
              <SortableHeader label="Tenant" sortKey="tenantName" currentSort={sortCol} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Property / Unit" sortKey="property" currentSort={sortCol} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Rent" sortKey="rentAmount" currentSort={sortCol} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Start" sortKey="startDate" currentSort={sortCol} currentDir={sortDir} onSort={handleSort} />
              <TableHead>End</TableHead>
              <SortableHeader label="Status" sortKey="status" currentSort={sortCol} currentDir={sortDir} onSort={handleSort} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columnCount}
                  className="h-24 text-center text-muted-foreground"
                >
                  No leases found.
                </TableCell>
              </TableRow>
            ) : (
              sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((lease) => {
                const isExpanded = expandedId === lease.id;
                const addendumCount = lease._count?.addendums ?? lease.addendums?.length ?? 0;

                return (
                  <ExpandableLeaseRow
                    key={lease.id}
                    lease={lease}
                    isExpanded={isExpanded}
                    onToggle={() => toggleExpanded(lease.id)}
                    addendumCount={addendumCount}
                    columnCount={columnCount}
                  />
                );
              })
            )}
          </TableBody>
        </Table>
        {Math.ceil(filtered.length / PAGE_SIZE) > 1 && (
          <PaginationControls page={page} totalPages={Math.ceil(filtered.length / PAGE_SIZE)} onPageChange={(p) => { setPage(p); setExpandedId(null); }} />
        )}
      </div>
    </div>
  );
}

/* ── Expandable Lease Row ─────────────────────────────────── */

interface ExpandableLeaseRowProps {
  lease: LeaseRow;
  isExpanded: boolean;
  onToggle: () => void;
  addendumCount: number;
  columnCount: number;
}

function ExpandableLeaseRow({
  lease,
  isExpanded,
  onToggle,
  addendumCount,
  columnCount,
}: ExpandableLeaseRowProps) {
  return (
    <>
      {/* Main row */}
      <TableRow
        className="border-border cursor-pointer hover:bg-muted/50"
        onClick={onToggle}
        role="button"
        aria-expanded={isExpanded}
      >
        <TableCell className="w-10 px-2">
          <Button
            variant="ghost"
            size="icon-xs"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            aria-label={isExpanded ? "Collapse row" : "Expand row"}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </TableCell>
        <TableCell>
          <span className="font-medium">
            {lease.tenant?.user?.name || "\u2014"}
          </span>
        </TableCell>
        <TableCell>
          {lease.unit?.property?.name || "\u2014"} #{lease.unit?.unitNumber || "\u2014"}
        </TableCell>
        <TableCell>{formatCurrency(Number(lease.rentAmount))}</TableCell>
        <TableCell>{formatDate(new Date(lease.startDate))}</TableCell>
        <TableCell>{formatDate(new Date(lease.endDate))}</TableCell>
        <TableCell>
          <StatusBadge status={lease.status} />
        </TableCell>
      </TableRow>

      {/* Expanded detail row */}
      {isExpanded && (
        <TableRow className="border-border hover:bg-transparent">
          <TableCell colSpan={columnCount} className="p-0">
            <div className="bg-muted/30 border-t border-border px-6 py-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Lease Period */}
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Lease Period
                  </p>
                  <p className="mt-1 text-sm">
                    {formatDate(new Date(lease.startDate))} &rarr;{" "}
                    {formatDate(new Date(lease.endDate))}
                  </p>
                </div>

                {/* Monthly Rent */}
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Monthly Rent
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    {formatCurrency(Number(lease.rentAmount))}
                  </p>
                </div>

                {/* Status */}
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Status
                  </p>
                  <div className="mt-1">
                    <StatusBadge status={lease.status} />
                  </div>
                </div>

                {/* Addendums */}
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Addendums
                  </p>
                  <div className="mt-1">
                    <Badge
                      variant={addendumCount > 0 ? "secondary" : "outline"}
                      className="text-xs"
                    >
                      {addendumCount} {addendumCount === 1 ? "Addendum" : "Addendums"}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {lease.notes && (
                <div className="mt-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Notes
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {lease.notes}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {lease.documentUrl && (
                  <>
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={lease.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <FileText className="mr-1.5 h-3.5 w-3.5" />
                        View Agreement
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={lease.documentUrl} download>
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        Download
                      </a>
                    </Button>
                  </>
                )}

                <Button variant="outline" size="sm" asChild>
                  <Link href={`/dashboard/leases/${lease.id}`}>
                    View Full Details
                    <ExternalLink className="ml-1.5 h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

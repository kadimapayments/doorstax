"use client";

import { useState } from "react";
import Link from "next/link";
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
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Search,
  ChevronDown,
  ChevronRight,
  Pencil,
  Save,
  X,
  ExternalLink,
  Send,
  CreditCard,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ViewAsLandlordButton } from "@/components/admin/view-as-landlord-button";
import { SendNoticeDialog } from "@/components/tenants/send-notice-dialog";

export interface LandlordRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  companyName: string;
  properties: number;
  units: number;
  occupiedUnits: number;
  volume: number;
  subscriptionStatus: string | null;
  managerStatus: string;
  boardingStatus: string | null;
  hasCardOnFile: boolean;
  onboardingComplete: boolean;
  onboardingProgress: number; // 0-4
  createdAt: string;
}

type StatusFilter = "ALL" | "PROSPECT" | "ACTIVE" | "INACTIVE";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  PROSPECT: {
    label: "Prospect",
    className: "bg-amber-500/15 text-amber-500 border-amber-500/20",
  },
  ACTIVE: {
    label: "Active",
    className: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
  },
  INACTIVE: {
    label: "Inactive",
    className: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
  },
};

const BOARDING_BADGE: Record<string, { label: string; className: string }> = {
  NOT_STARTED: {
    label: "Not Started",
    className: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
  },
  IN_PROGRESS: {
    label: "In Progress",
    className: "bg-blue-500/15 text-blue-500 border-blue-500/20",
  },
  SUBMITTED: {
    label: "Submitted",
    className: "bg-amber-500/15 text-amber-500 border-amber-500/20",
  },
  APPROVED: {
    label: "Approved",
    className: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
  },
  REJECTED: {
    label: "Rejected",
    className: "bg-destructive/15 text-destructive border-destructive/20",
  },
};

export function LandlordsTable({ rows: initialRows }: { rows: LandlordRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    companyName: "",
    managerStatus: "PROSPECT",
  });
  const [saving, setSaving] = useState(false);

  const filtered = rows.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.email.toLowerCase().includes(search.toLowerCase()) ||
      r.companyName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "ALL" || r.managerStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Counts for filter tabs
  const counts = {
    ALL: rows.length,
    PROSPECT: rows.filter((r) => r.managerStatus === "PROSPECT").length,
    ACTIVE: rows.filter((r) => r.managerStatus === "ACTIVE").length,
    INACTIVE: rows.filter((r) => r.managerStatus === "INACTIVE").length,
  };

  function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      setEditingId(null);
    } else {
      setExpandedId(id);
      setEditingId(null);
    }
  }

  function startEdit(row: LandlordRow) {
    setEditingId(row.id);
    setEditForm({
      name: row.name,
      email: row.email,
      phone: row.phone,
      companyName: row.companyName,
      managerStatus: row.managerStatus,
    });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/landlords/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      if (res.ok) {
        const updated = await res.json();
        setRows((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  name: updated.name,
                  email: updated.email,
                  phone: updated.phone ?? "",
                  companyName: updated.companyName ?? "",
                  managerStatus: updated.managerStatus ?? r.managerStatus,
                }
              : r
          )
        );
        setEditingId(null);
      }
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  }

  const filterTabs: { key: StatusFilter; label: string }[] = [
    { key: "ALL", label: "All" },
    { key: "PROSPECT", label: "Prospects" },
    { key: "ACTIVE", label: "Active" },
    { key: "INACTIVE", label: "Inactive" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {filtered.length} manager{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 rounded-lg bg-muted/50 p-1 w-fit">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-xs opacity-60">{counts[tab.key]}</span>
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border card-glow">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="w-8" />
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Boarding</TableHead>
              <TableHead>Onboarding</TableHead>
              <TableHead className="text-right">Properties</TableHead>
              <TableHead className="text-right">Units</TableHead>
              <TableHead className="text-right">Volume</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="h-24 text-center text-muted-foreground"
                >
                  {search
                    ? "No managers match your search."
                    : "No managers yet."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => {
                const isExpanded = expandedId === row.id;
                const isEditing = editingId === row.id;
                const statusInfo = STATUS_BADGE[row.managerStatus] || STATUS_BADGE.PROSPECT;
                const boardingInfo = row.boardingStatus
                  ? BOARDING_BADGE[row.boardingStatus]
                  : null;
                const needsReminder = row.managerStatus === "PROSPECT";

                return (
                  <>
                    {/* Main row */}
                    <TableRow
                      key={row.id}
                      className="border-border cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleExpand(row.id)}
                    >
                      <TableCell className="w-8 pr-0">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.email}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={statusInfo.className}
                        >
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {boardingInfo ? (
                          <Badge
                            variant="outline"
                            className={boardingInfo.className}
                          >
                            {boardingInfo.label}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.onboardingComplete ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-500/15 text-emerald-500 border-emerald-500/20"
                          >
                            Complete
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-blue-500/15 text-blue-500 border-blue-500/20"
                          >
                            {row.onboardingProgress}/4
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.properties}
                      </TableCell>
                      <TableCell className="text-right">{row.units}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(row.volume)}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <ViewAsLandlordButton landlordId={row.id} />
                      </TableCell>
                    </TableRow>

                    {/* Expanded detail row */}
                    {isExpanded && (
                      <TableRow className="border-border bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={10} className="p-0">
                          <div className="px-6 py-4">
                            {isEditing ? (
                              /* ─── Edit Mode ─── */
                              <div className="space-y-4">
                                <h4 className="text-sm font-semibold text-foreground">
                                  Edit Manager
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                                  <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">
                                      Name
                                    </label>
                                    <Input
                                      value={editForm.name}
                                      onChange={(e) =>
                                        setEditForm((f) => ({
                                          ...f,
                                          name: e.target.value,
                                        }))
                                      }
                                      className="h-9"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">
                                      Email
                                    </label>
                                    <Input
                                      value={editForm.email}
                                      onChange={(e) =>
                                        setEditForm((f) => ({
                                          ...f,
                                          email: e.target.value,
                                        }))
                                      }
                                      className="h-9"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">
                                      Phone
                                    </label>
                                    <Input
                                      value={editForm.phone}
                                      onChange={(e) =>
                                        setEditForm((f) => ({
                                          ...f,
                                          phone: e.target.value,
                                        }))
                                      }
                                      className="h-9"
                                      placeholder="(555) 123-4567"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">
                                      Company
                                    </label>
                                    <Input
                                      value={editForm.companyName}
                                      onChange={(e) =>
                                        setEditForm((f) => ({
                                          ...f,
                                          companyName: e.target.value,
                                        }))
                                      }
                                      className="h-9"
                                      placeholder="Company name"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">
                                      Status
                                    </label>
                                    <Select
                                      value={editForm.managerStatus}
                                      onValueChange={(v) =>
                                        setEditForm((f) => ({
                                          ...f,
                                          managerStatus: v,
                                        }))
                                      }
                                    >
                                      <SelectTrigger className="h-9 w-full">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="PROSPECT">Prospect</SelectItem>
                                        <SelectItem value="ACTIVE">Active</SelectItem>
                                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => saveEdit(row.id)}
                                    disabled={saving}
                                  >
                                    <Save className="mr-1.5 h-3.5 w-3.5" />
                                    {saving ? "Saving..." : "Save"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={cancelEdit}
                                    disabled={saving}
                                  >
                                    <X className="mr-1.5 h-3.5 w-3.5" />
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              /* ─── View Mode ─── */
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-0.5">
                                      Phone
                                    </p>
                                    <p className="text-foreground">
                                      {row.phone || "—"}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-0.5">
                                      Company
                                    </p>
                                    <p className="text-foreground">
                                      {row.companyName || "—"}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-0.5">
                                      Joined
                                    </p>
                                    <p className="text-foreground">
                                      {formatDate(new Date(row.createdAt))}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-0.5">
                                      Properties
                                    </p>
                                    <p className="text-foreground">
                                      {row.properties}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-0.5">
                                      Units (Occupied)
                                    </p>
                                    <p className="text-foreground">
                                      {row.units} ({row.occupiedUnits})
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-0.5">
                                      Subscription
                                    </p>
                                    <p className="text-foreground">
                                      {row.subscriptionStatus ? (
                                        <Badge
                                          variant="outline"
                                          className={
                                            row.subscriptionStatus === "ACTIVE"
                                              ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/20"
                                              : row.subscriptionStatus === "TRIALING"
                                              ? "bg-blue-500/15 text-blue-500 border-blue-500/20"
                                              : "bg-destructive/15 text-destructive border-destructive/20"
                                          }
                                        >
                                          {row.subscriptionStatus}
                                        </Badge>
                                      ) : (
                                        "—"
                                      )}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-0.5">
                                      Card on File
                                    </p>
                                    <p className="text-foreground flex items-center gap-1.5">
                                      {row.hasCardOnFile ? (
                                        <>
                                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                          <span className="text-emerald-600 text-sm">Yes</span>
                                        </>
                                      ) : (
                                        <>
                                          <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                                          <span className="text-muted-foreground text-sm">No</span>
                                        </>
                                      )}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startEdit(row);
                                    }}
                                  >
                                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                                    Edit
                                  </Button>
                                  <Link href={`/admin/landlords/${row.id}`}>
                                    <Button size="sm" variant="ghost">
                                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                                      View Dashboard
                                    </Button>
                                  </Link>
                                  {needsReminder && (
                                    <SendNoticeDialog
                                      targetUserId={row.id}
                                      targetName={row.name}
                                      trigger={
                                        <Button size="sm" variant="ghost">
                                          <Send className="mr-1.5 h-3.5 w-3.5" />
                                          Send App Reminder
                                        </Button>
                                      }
                                    />
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

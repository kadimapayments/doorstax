"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ClipboardList,
  Search,
  Plus,
  LayoutGrid,
  List,
  Loader2,
  Phone,
  Mail,
  Building2,
  Calendar,
  MessageSquare,
  ChevronRight,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PhoneInput, formatPhoneNumber } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/* ─── Types ──────────────────────────────────────────── */

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  buildings: number | null;
  units: number | null;
  source: string;
  status: string;
  notes: string | null;
  assignedTo: { id: string; name: string; email: string } | null;
  _count: { activities: number };
  createdAt: string;
  updatedAt: string;
}

interface Activity {
  id: string;
  type: string;
  content: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
}

interface LeadDetail extends Lead {
  activities: Activity[];
}

/* ─── Constants ──────────────────────────────────────── */

const STATUSES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "APPLIED",
  "UNDERWRITING",
  "ONBOARDING",
  "CONVERTED",
  "LOST",
] as const;

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  CONTACTED: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  QUALIFIED: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  APPLIED: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  UNDERWRITING: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  ONBOARDING: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  CONVERTED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  LOST: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const KANBAN_COLUMNS = ["NEW", "CONTACTED", "QUALIFIED", "APPLIED", "UNDERWRITING", "ONBOARDING", "CONVERTED", "LOST"];

/* ─── Helpers ────────────────────────────────────────── */

function relativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

/* ─── Page Component ─────────────────────────────────── */

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [view, setView] = useState<"kanban" | "table">("table");
  const [selectedLead, setSelectedLead] = useState<LeadDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  // ── Fetch leads ────────────────────────────────────
  const fetchLeads = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (sourceFilter !== "all") params.set("source", sourceFilter);

      const res = await fetch(`/api/dashboard/leads?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data);
      }
    } catch (err) {
      console.error("Failed to fetch leads:", err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, sourceFilter]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(fetchLeads, 300);
    return () => clearTimeout(t);
  }, [fetchLeads]);

  // ── Open lead detail ───────────────────────────────
  async function openDetail(id: string) {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/dashboard/leads/${id}`);
      if (res.ok) {
        setSelectedLead(await res.json());
      }
    } catch (err) {
      console.error("Failed to load lead:", err);
    } finally {
      setDetailLoading(false);
    }
  }

  // ── Update lead status ─────────────────────────────
  async function updateStatus(id: string, status: string) {
    try {
      const res = await fetch(`/api/dashboard/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setLeads((prev) =>
          prev.map((l) => (l.id === id ? { ...l, status } : l))
        );
        if (selectedLead?.id === id) {
          setSelectedLead((prev) => prev ? { ...prev, status } : prev);
        }
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  }

  // ── Add note ───────────────────────────────────────
  async function addNote() {
    if (!selectedLead || !noteText.trim()) return;
    setAddingNote(true);
    try {
      const res = await fetch(`/api/dashboard/leads/${selectedLead.id}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noteText.trim() }),
      });
      if (res.ok) {
        const activity = await res.json();
        setSelectedLead((prev) =>
          prev ? { ...prev, activities: [activity, ...prev.activities] } : prev
        );
        setNoteText("");
      }
    } catch (err) {
      console.error("Failed to add note:", err);
    } finally {
      setAddingNote(false);
    }
  }

  // ── Create lead ────────────────────────────────────
  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const body = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string,
      company: formData.get("company") as string,
      buildings: formData.get("buildings") as string,
      units: formData.get("units") as string,
      notes: formData.get("notes") as string,
    };

    try {
      const res = await fetch("/api/dashboard/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setShowCreateDialog(false);
        fetchLeads();
      }
    } catch (err) {
      console.error("Failed to create lead:", err);
    }
  }

  /* ─── Render ─────────────────────────────────────── */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track and manage prospective property manager leads.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-border p-0.5">
            <button
              onClick={() => setView("table")}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                view === "table"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("kanban")}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                view === "kanban"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>

          {/* Add Lead */}
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Lead</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="create-name">Full Name *</Label>
                  <Input id="create-name" name="name" required placeholder="John Smith" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-email">Email *</Label>
                  <Input id="create-email" name="email" type="email" required placeholder="john@example.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-phone">Phone</Label>
                  <PhoneInput id="create-phone" name="phone" placeholder="(555) 123-4567" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-company">Company *</Label>
                  <Input id="create-company" name="company" required placeholder="Acme Property Management" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="create-buildings"># Buildings</Label>
                    <Input id="create-buildings" name="buildings" type="number" min="1" placeholder="5" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-units"># Units</Label>
                    <Input id="create-units" name="units" type="number" min="1" placeholder="50" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-notes">Notes</Label>
                  <textarea
                    id="create-notes"
                    name="notes"
                    rows={3}
                    placeholder="Additional notes..."
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create Lead</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="WEBSITE">Website</SelectItem>
            <SelectItem value="REFERRAL">Referral</SelectItem>
            <SelectItem value="AGENT">Agent</SelectItem>
            <SelectItem value="MANUAL">Manual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty */}
      {!loading && leads.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-12 text-center">
          <ClipboardList className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold">No leads found</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Leads will appear here when visitors submit the form on your marketing pages, or you can add them manually.
          </p>
          <Button className="mt-4" size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Lead
          </Button>
        </div>
      )}

      {/* Table View */}
      {!loading && leads.length > 0 && view === "table" && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead>Created</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow
                  key={lead.id}
                  className="cursor-pointer"
                  onClick={() => openDetail(lead.id)}
                >
                  <TableCell className="font-medium">{lead.name}</TableCell>
                  <TableCell className="text-muted-foreground">{lead.company}</TableCell>
                  <TableCell>
                    <div className="flex flex-col text-xs text-muted-foreground">
                      <span>{lead.email}</span>
                      {lead.phone && <span>{formatPhoneNumber(lead.phone)}</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {lead.source}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", STATUS_COLORS[lead.status] || "bg-gray-100 text-gray-800")}>
                      {lead.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {lead.units ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {relativeTime(lead.createdAt)}
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Kanban View */}
      {!loading && leads.length > 0 && view === "kanban" && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {KANBAN_COLUMNS.map((col) => {
            const columnLeads = leads.filter((l) => l.status === col);
            return (
              <div
                key={col}
                className="flex w-[280px] shrink-0 flex-col rounded-lg border border-border bg-muted/30"
              >
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", STATUS_COLORS[col])}>
                      {col}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {columnLeads.length}
                    </span>
                  </div>
                </div>
                <div className="flex-1 space-y-2 p-2 min-h-[100px]">
                  {columnLeads.map((lead) => (
                    <button
                      key={lead.id}
                      onClick={() => openDetail(lead.id)}
                      className="w-full rounded-lg border border-border bg-background p-3 text-left shadow-sm hover:shadow-md transition-shadow"
                    >
                      <p className="text-sm font-medium truncate">{lead.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{lead.company}</p>
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{lead.source}</span>
                        <span>{relativeTime(lead.createdAt)}</span>
                      </div>
                      {lead._count.activities > 0 && (
                        <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <MessageSquare className="h-3 w-3" />
                          <span>{lead._count.activities}</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Lead Detail Slide-Over ──────────────────── */}
      {(selectedLead || detailLoading) && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => { setSelectedLead(null); setNoteText(""); }}
          />
          <div className="relative w-full max-w-lg bg-background shadow-xl overflow-y-auto animate-in slide-in-from-right">
            {detailLoading && !selectedLead ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : selectedLead ? (
              <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold">{selectedLead.name}</h2>
                    <p className="text-sm text-muted-foreground">{selectedLead.company}</p>
                  </div>
                  <button
                    onClick={() => { setSelectedLead(null); setNoteText(""); }}
                    className="rounded-md p-1 hover:bg-muted transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Contact info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${selectedLead.email}`} className="text-primary hover:underline">
                      {selectedLead.email}
                    </a>
                  </div>
                  {selectedLead.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{formatPhoneNumber(selectedLead.phone)}</span>
                    </div>
                  )}
                  {(selectedLead.buildings || selectedLead.units) && (
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {selectedLead.buildings && `${selectedLead.buildings} buildings`}
                        {selectedLead.buildings && selectedLead.units && " / "}
                        {selectedLead.units && `${selectedLead.units} units`}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Created {new Date(selectedLead.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Status */}
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={selectedLead.status}
                    onValueChange={(val) => updateStatus(selectedLead.id, val)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.charAt(0) + s.slice(1).toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Source & Badge */}
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{selectedLead.source}</Badge>
                </div>

                {/* Notes */}
                {selectedLead.notes && (
                  <div className="space-y-1">
                    <Label>Notes</Label>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3">
                      {selectedLead.notes}
                    </p>
                  </div>
                )}

                {/* Add Note */}
                <div className="space-y-2">
                  <Label>Add Note</Label>
                  <div className="flex gap-2">
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      rows={2}
                      placeholder="Type a note..."
                      className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={addNote}
                    disabled={!noteText.trim() || addingNote}
                  >
                    {addingNote ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <MessageSquare className="mr-2 h-4 w-4" />
                    )}
                    Add Note
                  </Button>
                </div>

                {/* Activity Timeline */}
                <div className="space-y-2">
                  <Label>Activity ({selectedLead.activities.length})</Label>
                  <div className="space-y-3">
                    {selectedLead.activities.map((a) => (
                      <div
                        key={a.id}
                        className="rounded-md border border-border bg-muted/20 p-3 text-sm"
                      >
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                          <span className="font-medium">
                            {a.user?.name || "System"}
                          </span>
                          <span>{relativeTime(a.createdAt)}</span>
                        </div>
                        {a.content && (
                          <p className="text-foreground whitespace-pre-wrap">
                            {a.content}
                          </p>
                        )}
                      </div>
                    ))}
                    {selectedLead.activities.length === 0 && (
                      <p className="text-sm text-muted-foreground">No activity yet.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

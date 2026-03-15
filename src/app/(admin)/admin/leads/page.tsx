"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";
import { Plus, ClipboardList, Kanban, List } from "lucide-react";
import { LeadsKanban } from "@/components/admin/leads-kanban";
import { LeadsTable } from "@/components/admin/leads-table";
import { LeadDetailSheet } from "@/components/admin/lead-detail-sheet";
import type { Lead, StaffUser } from "@/components/admin/lead-card";

const LEAD_SOURCES = ["WEBSITE", "REFERRAL", "AGENT", "MANUAL"];

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Add Lead form state
  const [newLead, setNewLead] = useState({
    name: "",
    email: "",
    phone: "",
    companyName: "",
    buildings: 0,
    units: 0,
    source: "MANUAL",
  });

  // Fetch leads
  useEffect(() => {
    Promise.all([
      fetch("/api/admin/leads").then((r) => r.json()),
      fetch("/api/admin/staff").then((r) => r.json()),
    ])
      .then(([leadsData, staffData]) => {
        setLeads(Array.isArray(leadsData) ? leadsData : leadsData.leads || []);
        setStaff(Array.isArray(staffData) ? staffData : staffData.staff || []);
      })
      .catch(() => toast.error("Failed to load leads"))
      .finally(() => setLoading(false));
  }, []);

  // Handlers
  const handleLeadUpdate = useCallback((updated: Lead) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l))
    );
    setSelectedLead((prev) =>
      prev?.id === updated.id ? { ...prev, ...updated } : prev
    );
  }, []);

  const handleLeadDelete = useCallback((leadId: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
    setSelectedLead((prev) => (prev?.id === leadId ? null : prev));
    setSheetOpen(false);
  }, []);

  const handleCardClick = useCallback((lead: Lead) => {
    setSelectedLead(lead);
    setSheetOpen(true);
  }, []);

  async function handleAddLead() {
    if (!newLead.name.trim() || !newLead.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newLead),
      });
      if (!res.ok) throw new Error();
      const created = await res.json();
      setLeads((prev) => [created, ...prev]);
      setAddDialogOpen(false);
      setNewLead({
        name: "",
        email: "",
        phone: "",
        companyName: "",
        buildings: 0,
        units: 0,
        source: "MANUAL",
      });
      toast.success("Lead created");
    } catch {
      toast.error("Failed to create lead");
    } finally {
      setSubmitting(false);
    }
  }

  // Metrics
  const totalLeads = leads.length;
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const newThisWeek = leads.filter(
    (l) => new Date(l.createdAt) >= oneWeekAgo
  ).length;
  const converted = leads.filter((l) => l.status === "CONVERTED").length;
  const conversionRate =
    totalLeads > 0 ? ((converted / totalLeads) * 100).toFixed(1) + "%" : "0%";
  const pipelineUnits = leads
    .filter((l) => !["CONVERTED", "LOST"].includes(l.status))
    .reduce((sum, l) => sum + l.units, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="Manage your sales pipeline and track lead progress."
        actions={
          <Button size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Lead
          </Button>
        }
      />

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total Leads" value={totalLeads} />
        <MetricCard label="New This Week" value={newThisWeek} />
        <MetricCard label="Conversion Rate" value={conversionRate} />
        <MetricCard label="Pipeline Units" value={pipelineUnits} />
      </div>

      {/* Content */}
      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">Loading leads...</p>
          </CardContent>
        </Card>
      ) : leads.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-12 w-12" />}
          title="No leads yet"
          description="Start building your pipeline by adding your first lead."
          action={
            <Button size="sm" onClick={() => setAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Lead
            </Button>
          }
        />
      ) : (
        <Tabs defaultValue="kanban">
          <TabsList>
            <TabsTrigger value="kanban">
              <Kanban className="mr-1.5 h-4 w-4" />
              Kanban
            </TabsTrigger>
            <TabsTrigger value="table">
              <List className="mr-1.5 h-4 w-4" />
              Table
            </TabsTrigger>
          </TabsList>

          <TabsContent value="kanban">
            <LeadsKanban
              leads={leads}
              onLeadUpdate={handleLeadUpdate}
              onCardClick={handleCardClick}
            />
          </TabsContent>

          <TabsContent value="table">
            <LeadsTable
              leads={leads}
              staff={staff}
              onRowClick={handleCardClick}
              onLeadUpdate={handleLeadUpdate}
              onLeadDelete={handleLeadDelete}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* Lead Detail Sheet */}
      <LeadDetailSheet
        lead={selectedLead}
        open={sheetOpen}
        staff={staff}
        onClose={() => setSheetOpen(false)}
        onUpdate={handleLeadUpdate}
      />

      {/* Add Lead Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Lead</DialogTitle>
            <DialogDescription>
              Create a new lead to track in your pipeline.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="lead-name">Name *</Label>
              <Input
                id="lead-name"
                placeholder="Full name"
                value={newLead.name}
                onChange={(e) =>
                  setNewLead((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lead-email">Email *</Label>
              <Input
                id="lead-email"
                type="email"
                placeholder="email@example.com"
                value={newLead.email}
                onChange={(e) =>
                  setNewLead((prev) => ({ ...prev, email: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lead-phone">Phone</Label>
              <Input
                id="lead-phone"
                placeholder="(555) 123-4567"
                value={newLead.phone}
                onChange={(e) =>
                  setNewLead((prev) => ({ ...prev, phone: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lead-company">Company</Label>
              <Input
                id="lead-company"
                placeholder="Company name"
                value={newLead.companyName}
                onChange={(e) =>
                  setNewLead((prev) => ({
                    ...prev,
                    companyName: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="lead-buildings">Buildings</Label>
                <Input
                  id="lead-buildings"
                  type="number"
                  min={0}
                  value={newLead.buildings}
                  onChange={(e) =>
                    setNewLead((prev) => ({
                      ...prev,
                      buildings: Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lead-units">Units</Label>
                <Input
                  id="lead-units"
                  type="number"
                  min={0}
                  value={newLead.units}
                  onChange={(e) =>
                    setNewLead((prev) => ({
                      ...prev,
                      units: Number(e.target.value),
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Source</Label>
              <Select
                value={newLead.source}
                onValueChange={(v) =>
                  setNewLead((prev) => ({ ...prev, source: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.charAt(0) + s.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleAddLead} disabled={submitting}>
              {submitting ? "Creating..." : "Create Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

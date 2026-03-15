"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatPhoneNumber } from "@/components/ui/phone-input";
import { toast } from "sonner";
import {
  Save,
  Plus,
  X,
  MessageSquare,
  ArrowRightCircle,
  XCircle,
  UserPlus,
  Phone,
  Mail,
  Activity as ActivityIcon,
  Pencil,
  Check,
} from "lucide-react";
import type { Lead, Activity, StaffUser } from "./lead-card";

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

const activityIcons: Record<string, React.ReactNode> = {
  STATUS_CHANGE: <ArrowRightCircle className="h-4 w-4 text-blue-500" />,
  NOTE: <MessageSquare className="h-4 w-4 text-emerald-500" />,
  ASSIGNED: <UserPlus className="h-4 w-4 text-purple-500" />,
  CALL: <Phone className="h-4 w-4 text-amber-500" />,
  EMAIL: <Mail className="h-4 w-4 text-cyan-500" />,
  CREATED: <Plus className="h-4 w-4 text-muted-foreground" />,
};

interface LeadDetailSheetProps {
  lead: Lead | null;
  open: boolean;
  staff: StaffUser[];
  onClose: () => void;
  onUpdate: (lead: Lead) => void;
}

export function LeadDetailSheet({
  lead,
  open,
  staff,
  onClose,
  onUpdate,
}: LeadDetailSheetProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    companyName: "",
    buildings: 0,
    units: 0,
  });
  const [noteText, setNoteText] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  const [newFieldKey, setNewFieldKey] = useState("");
  const [newFieldValue, setNewFieldValue] = useState("");

  // Reset state when lead changes
  useEffect(() => {
    if (lead) {
      setFormData({
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        companyName: lead.companyName,
        buildings: lead.buildings,
        units: lead.units,
      });
      setActivities(lead.activities || []);
      setCustomFields(lead.customFields || {});
      setEditingField(null);
      setNoteText("");
    }
  }, [lead]);

  // Fetch activities when sheet opens
  useEffect(() => {
    if (!open || !lead) return;
    fetch(`/api/admin/leads/${lead.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.activities) setActivities(data.activities);
        if (data.customFields) setCustomFields(data.customFields || {});
      })
      .catch(() => {});
  }, [open, lead]);

  const patchLead = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!lead) return;
      try {
        const res = await fetch(`/api/admin/leads/${lead.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error();
        const updated = await res.json();
        onUpdate(updated);
        toast.success("Lead updated");
      } catch {
        toast.error("Failed to update lead");
      }
    },
    [lead, onUpdate]
  );

  async function handleFieldSave(field: string) {
    const value = (formData as Record<string, unknown>)[field];
    await patchLead({ [field]: value });
    setEditingField(null);
  }

  async function handleStatusChange(newStatus: string) {
    if (!lead) return;
    await patchLead({ status: newStatus });
  }

  async function handleAssignChange(userId: string) {
    if (!lead) return;
    await patchLead({ assignedToId: userId === "unassigned" ? null : userId });
  }

  async function handleAddNote() {
    if (!lead || !noteText.trim()) return;
    setSubmittingNote(true);
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "NOTE", content: noteText.trim() }),
      });
      if (!res.ok) throw new Error();
      const activity = await res.json();
      setActivities((prev) => [activity, ...prev]);
      setNoteText("");
      toast.success("Note added");
    } catch {
      toast.error("Failed to add note");
    } finally {
      setSubmittingNote(false);
    }
  }

  async function handleAddCustomField() {
    if (!lead || !newFieldKey.trim()) return;
    const updated = { ...customFields, [newFieldKey.trim()]: newFieldValue };
    await patchLead({ customFields: updated });
    setCustomFields(updated);
    setNewFieldKey("");
    setNewFieldValue("");
  }

  async function handleRemoveCustomField(key: string) {
    if (!lead) return;
    const updated = { ...customFields };
    delete updated[key];
    await patchLead({ customFields: updated });
    setCustomFields(updated);
  }

  async function handleConvertToManager() {
    if (!lead) return;
    await patchLead({ status: "CONVERTED" });
    toast.success("Lead marked as Converted. Create a Manager account from the Managers page.");
  }

  async function handleMarkAsLost() {
    if (!lead) return;
    await patchLead({ status: "LOST" });
  }

  if (!lead) return null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg overflow-y-auto"
        showCloseButton
      >
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <SheetTitle className="truncate">{lead.name}</SheetTitle>
              <SheetDescription className="truncate">
                {lead.companyName || lead.email}
              </SheetDescription>
            </div>
            <StatusBadge status={lead.status} />
          </div>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-6">
          {/* Editable Fields */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Details
            </h3>
            {(
              [
                { key: "name", label: "Name", type: "text" },
                { key: "email", label: "Email", type: "email" },
                { key: "phone", label: "Phone", type: "tel" },
                { key: "companyName", label: "Company", type: "text" },
                { key: "buildings", label: "Buildings", type: "number" },
                { key: "units", label: "Units", type: "number" },
              ] as const
            ).map((field) => (
              <div key={field.key} className="flex items-center gap-2">
                <Label className="w-20 shrink-0 text-xs text-muted-foreground">
                  {field.label}
                </Label>
                {editingField === field.key ? (
                  <div className="flex flex-1 items-center gap-1">
                    <Input
                      type={field.type}
                      value={formData[field.key]}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          [field.key]:
                            field.type === "number"
                              ? Number(e.target.value)
                              : e.target.value,
                        }))
                      }
                      className="h-8 text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleFieldSave(field.key);
                        if (e.key === "Escape") setEditingField(null);
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleFieldSave(field.key)}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setEditingField(null)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <button
                    className="group flex flex-1 items-center gap-1 rounded px-2 py-1 text-sm text-left hover:bg-muted"
                    onClick={() => setEditingField(field.key)}
                  >
                    <span className="flex-1 truncate">
                      {field.key === "phone" && formData.phone
                        ? formatPhoneNumber(formData.phone)
                        : String(formData[field.key]) || (
                            <span className="italic text-muted-foreground">
                              Empty
                            </span>
                          )}
                    </span>
                    <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </button>
                )}
              </div>
            ))}
          </section>

          {/* Status & Assignment */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Status & Assignment
            </h3>
            <div className="flex items-center gap-2">
              <Label className="w-20 shrink-0 text-xs text-muted-foreground">
                Status
              </Label>
              <Select
                value={lead.status}
                onValueChange={handleStatusChange}
              >
                <SelectTrigger className="h-8 flex-1 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.charAt(0) + s.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="w-20 shrink-0 text-xs text-muted-foreground">
                Assign To
              </Label>
              <Select
                value={lead.assignedToId || "unassigned"}
                onValueChange={handleAssignChange}
              >
                <SelectTrigger className="h-8 flex-1 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          {/* Custom Fields */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Custom Fields
            </h3>
            {Object.entries(customFields).length === 0 && (
              <p className="text-xs text-muted-foreground italic">
                No custom fields
              </p>
            )}
            {Object.entries(customFields).map(([key, val]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="w-24 shrink-0 truncate text-xs font-medium text-muted-foreground">
                  {key}
                </span>
                <span className="flex-1 truncate text-sm">{val}</span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => handleRemoveCustomField(key)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Field name"
                  value={newFieldKey}
                  onChange={(e) => setNewFieldKey(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex-1">
                <Input
                  placeholder="Value"
                  value={newFieldValue}
                  onChange={(e) => setNewFieldValue(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddCustomField}
                disabled={!newFieldKey.trim()}
              >
                <Plus className="mr-1 h-3 w-3" />
                Add
              </Button>
            </div>
          </section>

          {/* Activity Timeline */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Activity
            </h3>

            {/* Add Note */}
            <div className="space-y-2">
              <textarea
                placeholder="Add a note..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                rows={3}
              />
              <Button
                size="sm"
                onClick={handleAddNote}
                disabled={!noteText.trim() || submittingNote}
              >
                <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                {submittingNote ? "Adding..." : "Add Note"}
              </Button>
            </div>

            {/* Timeline */}
            <div className="space-y-3">
              {activities.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  No activity yet
                </p>
              ) : (
                activities.map((act) => (
                  <div key={act.id} className="flex gap-3">
                    <div className="mt-0.5 shrink-0">
                      {activityIcons[act.type] || (
                        <ActivityIcon className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {act.userName && (
                          <span className="text-xs font-medium">
                            {act.userName}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(act.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {act.content}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Quick Actions */}
          <section className="space-y-3 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Quick Actions
            </h3>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleConvertToManager}
                disabled={lead.status === "CONVERTED"}
              >
                <ArrowRightCircle className="mr-1.5 h-3.5 w-3.5 text-emerald-500" />
                Convert to Manager
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAsLost}
                disabled={lead.status === "LOST"}
              >
                <XCircle className="mr-1.5 h-3.5 w-3.5 text-red-500" />
                Mark as Lost
              </Button>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

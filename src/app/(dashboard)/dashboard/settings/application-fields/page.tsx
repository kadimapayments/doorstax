"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Loader2,
  Eye,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { showConfirm } from "@/components/admin/dialog-prompt";
import { cn } from "@/lib/utils";
import { SECTION_LABELS, FIELD_TYPES } from "@/lib/application-fields";

interface Field {
  id: string;
  label: string;
  type: string;
  options: string[];
  required: boolean;
  enabled: boolean;
  sortOrder: number;
  section: string;
  placeholder: string | null;
  helpText: string | null;
}

const SECTIONS = ["PERSONAL", "EMPLOYMENT", "RENTAL_HISTORY", "REFERENCES", "CUSTOM"];

export default function ApplicationFieldsPage() {
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [editField, setEditField] = useState<Field | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addSection, setAddSection] = useState("CUSTOM");
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Form state for add/edit
  const [formLabel, setFormLabel] = useState("");
  const [formType, setFormType] = useState("TEXT");
  const [formRequired, setFormRequired] = useState(false);
  const [formSection, setFormSection] = useState("CUSTOM");
  const [formPlaceholder, setFormPlaceholder] = useState("");
  const [formHelpText, setFormHelpText] = useState("");
  const [formOptions, setFormOptions] = useState<string[]>([]);

  useEffect(() => {
    fetchFields();
  }, []);

  async function fetchFields() {
    try {
      const res = await fetch("/api/application-fields");
      if (res.ok) setFields(await res.json());
    } catch {
      toast.error("Failed to load fields");
    } finally {
      setLoading(false);
    }
  }

  function openAdd(section: string) {
    setAddSection(section);
    setFormLabel("");
    setFormType("TEXT");
    setFormRequired(false);
    setFormSection(section);
    setFormPlaceholder("");
    setFormHelpText("");
    setFormOptions([]);
    setShowAddDialog(true);
  }

  function openEdit(field: Field) {
    setEditField(field);
    setFormLabel(field.label);
    setFormType(field.type);
    setFormRequired(field.required);
    setFormSection(field.section);
    setFormPlaceholder(field.placeholder || "");
    setFormHelpText(field.helpText || "");
    setFormOptions(field.options || []);
  }

  async function handleSave() {
    if (!formLabel.trim()) {
      toast.error("Label is required");
      return;
    }

    const body = {
      label: formLabel,
      type: formType,
      required: formRequired,
      section: formSection,
      placeholder: formPlaceholder || null,
      helpText: formHelpText || null,
      options: formType === "SELECT" ? formOptions.filter(Boolean) : [],
    };

    if (editField) {
      // Update
      try {
        const res = await fetch(`/api/application-fields/${editField.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          toast.success("Field updated");
          setEditField(null);
          fetchFields();
        } else toast.error("Failed to update");
      } catch {
        toast.error("Failed to update");
      }
    } else {
      // Create
      try {
        const res = await fetch("/api/application-fields", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, section: addSection }),
        });
        if (res.ok) {
          toast.success("Field added");
          setShowAddDialog(false);
          fetchFields();
        } else toast.error("Failed to add");
      } catch {
        toast.error("Failed to add");
      }
    }
  }

  async function handleDelete(id: string) {
    if (!await showConfirm({ title: "Delete Application Field?", description: "This will permanently remove this field. Any submitted answers for it will also be deleted. This cannot be undone.", confirmLabel: "Delete Field", destructive: true })) return;
    try {
      const res = await fetch(`/api/application-fields/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Field deleted");
        setFields((prev) => prev.filter((f) => f.id !== id));
      } else toast.error("Failed to delete");
    } catch {
      toast.error("Failed to delete");
    }
  }

  async function toggleEnabled(field: Field) {
    const newEnabled = !field.enabled;
    setFields((prev) => prev.map((f) => (f.id === field.id ? { ...f, enabled: newEnabled } : f)));
    try {
      await fetch(`/api/application-fields/${field.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: newEnabled }),
      });
    } catch {
      setFields((prev) => prev.map((f) => (f.id === field.id ? { ...f, enabled: !newEnabled } : f)));
      toast.error("Failed to update");
    }
  }

  async function toggleRequired(field: Field) {
    const newRequired = !field.required;
    setFields((prev) => prev.map((f) => (f.id === field.id ? { ...f, required: newRequired } : f)));
    try {
      await fetch(`/api/application-fields/${field.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ required: newRequired }),
      });
    } catch {
      setFields((prev) => prev.map((f) => (f.id === field.id ? { ...f, required: !newRequired } : f)));
    }
  }

  async function moveField(field: Field, direction: "up" | "down") {
    const sectionFields = fields.filter((f) => f.section === field.section).sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sectionFields.findIndex((f) => f.id === field.id);
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === sectionFields.length - 1) return;

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const newOrder = [...sectionFields];
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];

    const ids = newOrder.map((f) => f.id);
    // Optimistic update
    setFields((prev) => {
      const updated = [...prev];
      ids.forEach((id, i) => {
        const f = updated.find((u) => u.id === id);
        if (f) f.sortOrder = i;
      });
      return [...updated].sort((a, b) => {
        const sA = SECTIONS.indexOf(a.section);
        const sB = SECTIONS.indexOf(b.section);
        return sA !== sB ? sA - sB : a.sortOrder - b.sortOrder;
      });
    });

    try {
      await fetch("/api/application-fields/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldIds: ids }),
      });
    } catch {
      toast.error("Failed to reorder");
      fetchFields();
    }
  }

  function toggleSection(section: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Application Form Builder"
        description="Customize the fields applicants must fill out when applying for your units."
      />

      {SECTIONS.map((section) => {
        const sectionFields = fields
          .filter((f) => f.section === section)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        const isCollapsed = collapsedSections.has(section);

        return (
          <Card key={section} className="border-border">
            <CardHeader className="pb-2">
              <button
                onClick={() => toggleSection(section)}
                className="flex w-full items-center justify-between"
              >
                <CardTitle className="text-sm flex items-center gap-2">
                  {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {SECTION_LABELS[section] || section}
                  <span className="text-xs font-normal text-muted-foreground">
                    ({sectionFields.filter((f) => f.enabled).length} active)
                  </span>
                </CardTitle>
              </button>
            </CardHeader>
            {!isCollapsed && (
              <CardContent className="space-y-1.5">
                {sectionFields.map((field, idx) => (
                  <div
                    key={field.id}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                      !field.enabled && "opacity-50"
                    )}
                  >
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => moveField(field, "up")} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button onClick={() => moveField(field, "down")} disabled={idx === sectionFields.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{field.label}</span>
                      {field.required && <span className="text-red-500 ml-1 text-xs">*</span>}
                    </div>
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {field.type}
                    </span>
                    <button
                      onClick={() => toggleRequired(field)}
                      className={cn("text-xs px-2 py-0.5 rounded border", field.required ? "bg-red-500/10 text-red-500 border-red-500/20" : "text-muted-foreground")}
                      title="Toggle required"
                    >
                      Req
                    </button>
                    <button
                      onClick={() => toggleEnabled(field)}
                      className={cn(
                        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                        field.enabled ? "bg-green-500" : "bg-muted"
                      )}
                      title={field.enabled ? "Enabled" : "Disabled"}
                    >
                      <span className={cn("inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform", field.enabled ? "translate-x-4.5" : "translate-x-0.5")} />
                    </button>
                    <button onClick={() => openEdit(field)} className="p-1 text-muted-foreground hover:text-foreground">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDelete(field.id)} className="p-1 text-muted-foreground hover:text-red-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => openAdd(section)}
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline mt-2"
                >
                  <Plus className="h-3 w-3" />
                  Add field to {SECTION_LABELS[section] || section}
                </button>
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Add/Edit Dialog */}
      <Dialog
        open={showAddDialog || !!editField}
        onOpenChange={(open) => {
          if (!open) { setShowAddDialog(false); setEditField(null); }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editField ? "Edit Field" : "Add Field"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Label *</Label>
              <Input value={formLabel} onChange={(e) => setFormLabel(e.target.value)} placeholder="e.g. Do you have pets?" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            {formType === "SELECT" && (
              <div className="space-y-2">
                <Label>Options</Label>
                {formOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={opt}
                      onChange={(e) => {
                        const next = [...formOptions];
                        next[i] = e.target.value;
                        setFormOptions(next);
                      }}
                      placeholder={`Option ${i + 1}`}
                    />
                    <button onClick={() => setFormOptions(formOptions.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-red-500">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button onClick={() => setFormOptions([...formOptions, ""])} className="text-xs text-primary hover:underline">
                  + Add option
                </button>
              </div>
            )}
            {editField && (
              <div className="space-y-2">
                <Label>Section</Label>
                <select
                  value={formSection}
                  onChange={(e) => setFormSection(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                >
                  {SECTIONS.map((s) => (
                    <option key={s} value={s}>{SECTION_LABELS[s] || s}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Placeholder</Label>
              <Input value={formPlaceholder} onChange={(e) => setFormPlaceholder(e.target.value)} placeholder="Placeholder text..." />
            </div>
            <div className="space-y-2">
              <Label>Help Text</Label>
              <Input value={formHelpText} onChange={(e) => setFormHelpText(e.target.value)} placeholder="Additional guidance..." />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={formRequired} onChange={(e) => setFormRequired(e.target.checked)} className="h-4 w-4 rounded border-input" />
              <Label>Required</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowAddDialog(false); setEditField(null); }}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                {editField ? "Save Changes" : "Add Field"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

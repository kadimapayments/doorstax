"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
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
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Save,
  Copy,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TemplateField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
  section?: string;
  placeholder?: string;
  helpText?: string;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  fields: TemplateField[];
  isDefault: boolean;
  _count: { units: number };
}

const FIELD_TYPES = [
  "text",
  "textarea",
  "select",
  "number",
  "date",
  "email",
  "phone",
];

const SECTION_LABELS: Record<string, string> = {
  personal: "Personal Information",
  employment: "Employment",
  rental_history: "Rental History",
  references: "References",
  custom: "Additional Questions",
};

export default function TemplateEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Reminder settings
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderDelayHours, setReminderDelayHours] = useState(24);
  const [reminderMaxCount, setReminderMaxCount] = useState(3);
  const [reminderIntervalHours, setReminderIntervalHours] = useState(48);

  // Field edit dialog
  const [editingField, setEditingField] = useState<TemplateField | null>(null);
  const [editingIndex, setEditingIndex] = useState<number>(-1);
  const [showFieldDialog, setShowFieldDialog] = useState(false);
  const [fieldName, setFieldName] = useState("");
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldType, setFieldType] = useState("text");
  const [fieldRequired, setFieldRequired] = useState(false);
  const [fieldOptions, setFieldOptions] = useState<string[]>([]);
  const [fieldPlaceholder, setFieldPlaceholder] = useState("");
  const [fieldHelpText, setFieldHelpText] = useState("");

  const fetchTemplate = useCallback(async () => {
    try {
      const res = await fetch(`/api/applications/templates/${id}`);
      if (res.ok) {
        const data = await res.json();
        setTemplate(data);
        setName(data.name);
        setDescription(data.description || "");
        setReminderEnabled(data.reminderEnabled ?? true);
        setReminderDelayHours(data.reminderDelayHours ?? 24);
        setReminderMaxCount(data.reminderMaxCount ?? 3);
        setReminderIntervalHours(data.reminderIntervalHours ?? 48);
      } else {
        toast.error("Template not found");
        router.push("/dashboard/applications/templates");
      }
    } catch {
      toast.error("Failed to load template");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchTemplate();
  }, [fetchTemplate]);

  async function saveTemplate() {
    if (!template) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/applications/templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          fields: template.fields,
          reminderEnabled,
          reminderDelayHours,
          reminderMaxCount,
          reminderIntervalHours,
        }),
      });
      if (res.ok) {
        toast.success("Template saved");
        const updated = await res.json();
        setTemplate((prev) =>
          prev ? { ...prev, ...updated } : prev
        );
      } else toast.error("Failed to save");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function openAddField() {
    setEditingField(null);
    setEditingIndex(-1);
    setFieldName("");
    setFieldLabel("");
    setFieldType("text");
    setFieldRequired(false);
    setFieldOptions([]);
    setFieldPlaceholder("");
    setFieldHelpText("");
    setShowFieldDialog(true);
  }

  function openEditField(field: TemplateField, index: number) {
    setEditingField(field);
    setEditingIndex(index);
    setFieldName(field.name);
    setFieldLabel(field.label);
    setFieldType(field.type);
    setFieldRequired(field.required);
    setFieldOptions(field.options || []);
    setFieldPlaceholder(field.placeholder || "");
    setFieldHelpText(field.helpText || "");
    setShowFieldDialog(true);
  }

  function handleSaveField() {
    if (!fieldLabel.trim()) {
      toast.error("Label is required");
      return;
    }
    if (!template) return;

    const field: TemplateField = {
      name: fieldName || fieldLabel.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      label: fieldLabel,
      type: fieldType,
      required: fieldRequired,
      ...(fieldType === "select" && {
        options: fieldOptions.filter(Boolean),
      }),
      ...(fieldPlaceholder && { placeholder: fieldPlaceholder }),
      ...(fieldHelpText && { helpText: fieldHelpText }),
    };

    if (editingIndex >= 0) {
      const updated = [...template.fields];
      updated[editingIndex] = field;
      setTemplate({ ...template, fields: updated });
    } else {
      setTemplate({
        ...template,
        fields: [...template.fields, field],
      });
    }
    setShowFieldDialog(false);
    toast.info("Field updated — click Save to persist");
  }

  function deleteField(index: number) {
    if (!template) return;
    if (!confirm("Remove this field?")) return;
    const updated = template.fields.filter((_, i) => i !== index);
    setTemplate({ ...template, fields: updated });
    toast.info("Field removed — click Save to persist");
  }

  function moveField(index: number, direction: "up" | "down") {
    if (!template) return;
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= template.fields.length) return;
    const updated = [...template.fields];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setTemplate({ ...template, fields: updated });
  }

  async function duplicateTemplate() {
    if (!template) return;
    try {
      const res = await fetch("/api/applications/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Copy of ${template.name}`,
          description: template.description,
          fields: template.fields,
          isDefault: false,
        }),
      });
      if (res.ok) {
        const newTemplate = await res.json();
        toast.success("Template duplicated");
        router.push(
          `/dashboard/applications/templates/${newTemplate.id}`
        );
      } else toast.error("Failed to duplicate");
    } catch {
      toast.error("Failed to duplicate");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!template) return null;

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/applications/templates"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Templates
      </Link>

      <PageHeader
        title={name || "Edit Template"}
        description={`${template.fields.length} fields \u00b7 ${template._count.units} unit${template._count.units !== 1 ? "s" : ""} using`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={duplicateTemplate}>
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Duplicate
            </Button>
            <Button size="sm" onClick={saveTemplate} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-3.5 w-3.5" />
              )}
              {saving ? "Saving..." : "Save Template"}
            </Button>
          </div>
        }
      />

      {/* Name + Description */}
      <Card className="border-border">
        <CardContent className="p-5 space-y-4">
          <div className="space-y-2">
            <Label>Template Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Standard Rental Application"
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Reminder Settings */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Application Reminders</CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <p className="text-xs text-muted-foreground">
            Automatically remind applicants who started but didn&apos;t finish
            their application. Reminders only send while the unit is still
            available.
          </p>

          <label className="flex items-center justify-between">
            <span className="text-sm font-medium">Enable auto-reminders</span>
            <input
              type="checkbox"
              checked={reminderEnabled}
              onChange={(e) => setReminderEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-input accent-primary"
            />
          </label>

          {reminderEnabled && (
            <div className="space-y-3 pl-3 border-l-2 border-primary/20">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  First reminder after
                </Label>
                <select
                  value={reminderDelayHours}
                  onChange={(e) =>
                    setReminderDelayHours(Number(e.target.value))
                  }
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                >
                  <option value={6}>6 hours</option>
                  <option value={12}>12 hours</option>
                  <option value={24}>24 hours</option>
                  <option value={48}>48 hours</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Follow-up interval
                </Label>
                <select
                  value={reminderIntervalHours}
                  onChange={(e) =>
                    setReminderIntervalHours(Number(e.target.value))
                  }
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                >
                  <option value={24}>Every 24 hours</option>
                  <option value={48}>Every 48 hours</option>
                  <option value={72}>Every 72 hours</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Maximum reminders
                </Label>
                <select
                  value={reminderMaxCount}
                  onChange={(e) =>
                    setReminderMaxCount(Number(e.target.value))
                  }
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                >
                  <option value={1}>1 reminder</option>
                  <option value={2}>2 reminders</option>
                  <option value={3}>3 reminders</option>
                  <option value={5}>5 reminders</option>
                </select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fields */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Fields ({template.fields.length})
            </CardTitle>
            <Button variant="outline" size="sm" onClick={openAddField}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Field
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {template.fields.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No fields yet. Click &ldquo;Add Field&rdquo; to get started.
            </p>
          )}
          {template.fields.map((field, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
            >
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => moveField(idx, "up")}
                  disabled={idx === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  onClick={() => moveField(idx, "down")}
                  disabled={idx === template.fields.length - 1}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-medium">{field.label}</span>
                {field.required && (
                  <span className="text-red-500 ml-1 text-xs">*</span>
                )}
              </div>
              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {field.type}
              </span>
              {field.options && field.options.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {field.options.length} opts
                </span>
              )}
              <button
                onClick={() => openEditField(field, idx)}
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => deleteField(idx)}
                className="p-1 text-muted-foreground hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Field Add/Edit Dialog */}
      <Dialog
        open={showFieldDialog}
        onOpenChange={(open) => {
          if (!open) setShowFieldDialog(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingIndex >= 0 ? "Edit Field" : "Add Field"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Label *</Label>
              <Input
                value={fieldLabel}
                onChange={(e) => setFieldLabel(e.target.value)}
                placeholder="e.g. Do you have pets?"
              />
            </div>
            <div className="space-y-2">
              <Label>Field Name (internal)</Label>
              <Input
                value={fieldName}
                onChange={(e) => setFieldName(e.target.value)}
                placeholder="auto-generated from label"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <select
                value={fieldType}
                onChange={(e) => setFieldType(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            {fieldType === "select" && (
              <div className="space-y-2">
                <Label>Options</Label>
                {fieldOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={opt}
                      onChange={(e) => {
                        const next = [...fieldOptions];
                        next[i] = e.target.value;
                        setFieldOptions(next);
                      }}
                      placeholder={`Option ${i + 1}`}
                    />
                    <button
                      onClick={() =>
                        setFieldOptions(fieldOptions.filter((_, j) => j !== i))
                      }
                      className="text-muted-foreground hover:text-red-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setFieldOptions([...fieldOptions, ""])}
                  className="text-xs text-primary hover:underline"
                >
                  + Add option
                </button>
              </div>
            )}
            <div className="space-y-2">
              <Label>Placeholder</Label>
              <Input
                value={fieldPlaceholder}
                onChange={(e) => setFieldPlaceholder(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Help Text</Label>
              <Input
                value={fieldHelpText}
                onChange={(e) => setFieldHelpText(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={fieldRequired}
                onChange={(e) => setFieldRequired(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <Label>Required</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowFieldDialog(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveField}>
                {editingIndex >= 0 ? "Save Changes" : "Add Field"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

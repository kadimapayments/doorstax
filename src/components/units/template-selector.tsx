"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText } from "lucide-react";

interface TemplateSelectorProps {
  unitId: string;
  propertyId: string;
  currentTemplateId: string | null;
  templates: Array<{
    id: string;
    name: string;
    fieldCount: number;
    isDefault?: boolean;
  }>;
}

export function TemplateSelector({
  unitId,
  propertyId,
  currentTemplateId,
  templates,
}: TemplateSelectorProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [value, setValue] = useState(currentTemplateId || "");

  async function handleChange(newValue: string) {
    setValue(newValue);
    setSaving(true);
    try {
      const res = await fetch(
        `/api/properties/${propertyId}/units/${unitId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            applicationTemplateId: newValue || null,
          }),
        }
      );
      if (res.ok) {
        toast.success(
          newValue ? "Application template assigned" : "Template removed"
        );
        router.refresh();
      } else {
        toast.error("Failed to update template");
        setValue(currentTemplateId || "");
      }
    } catch {
      toast.error("Failed to update template");
      setValue(currentTemplateId || "");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-base font-semibold">Application Template</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Choose which application form applicants will fill out for this unit.
      </p>
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={saving}
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm disabled:opacity-50"
      >
        <option value="">
          {(() => {
            const def = templates.find((t) => t.isDefault);
            return def
              ? `— Use default template (${def.name}) —`
              : "Default fields (no template)";
          })()}
        </option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.isDefault ? "★ " : ""}
            {t.name} ({t.fieldCount} fields)
            {t.isDefault ? " · Default" : ""}
          </option>
        ))}
      </select>
      {value && (
        <p className="text-xs text-muted-foreground">
          Applicants at{" "}
          <span className="font-medium text-primary">
            /apply/{unitId.slice(0, 8)}...
          </span>{" "}
          will see this template&apos;s fields.
        </p>
      )}
    </div>
  );
}

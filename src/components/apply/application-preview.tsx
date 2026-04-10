"use client";

import { FileText, Upload, PenLine, Eye } from "lucide-react";

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

interface DocRequirement {
  id: string;
  label: string;
  description?: string | null;
  required: boolean;
  enabled?: boolean;
}

interface ApplicationPreviewProps {
  templateName: string;
  fields: TemplateField[];
  docRequirements?: DocRequirement[];
}

function groupBySection(fields: TemplateField[]) {
  const sections = new Map<string, TemplateField[]>();
  for (const field of fields) {
    const key = (field.section || "custom").toUpperCase();
    const list = sections.get(key) || [];
    list.push(field);
    sections.set(key, list);
  }
  return sections;
}

const SECTION_LABELS: Record<string, string> = {
  PERSONAL: "Personal Information",
  EMPLOYMENT: "Employment",
  RENTAL_HISTORY: "Rental History",
  REFERENCES: "References",
  CUSTOM: "Additional Questions",
};

function renderMockInput(field: TemplateField) {
  const baseClass =
    "w-full rounded-md border border-input bg-background/50 px-2.5 py-1.5 text-xs text-muted-foreground pointer-events-none";

  switch (field.type.toUpperCase()) {
    case "TEXTAREA":
      return (
        <div
          className={baseClass + " h-14"}
          aria-hidden
        >
          {field.placeholder || ""}
        </div>
      );
    case "SELECT":
      return (
        <div className={baseClass + " flex items-center justify-between"}>
          <span>{field.options?.[0] || "Select\u2026"}</span>
          <span className="text-[10px]">\u25BC</span>
        </div>
      );
    case "CHECKBOX":
      return (
        <div className="flex items-center gap-2">
          <div className="h-3.5 w-3.5 rounded border border-input" />
          <span className="text-xs text-muted-foreground">Yes</span>
        </div>
      );
    default:
      return (
        <div className={baseClass}>
          {field.placeholder || ""}
        </div>
      );
  }
}

export function ApplicationPreview({
  templateName,
  fields,
  docRequirements = [],
}: ApplicationPreviewProps) {
  const sections = groupBySection(fields);
  const enabledDocs = docRequirements.filter((d) => d.enabled !== false);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Preview header */}
      <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">
          Live Preview
        </span>
      </div>

      {/* Preview content (scaled down for panel) */}
      <div className="p-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
        {/* Mock header */}
        <div className="text-center pb-3 border-b">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            DoorStax
          </p>
          <h3 className="text-sm font-bold mt-1">Rental Application</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {templateName || "Application Template"}
          </p>
        </div>

        {/* Property card mock */}
        <div className="rounded-lg border bg-muted/20 p-3">
          <p className="text-xs font-semibold">Sample Property</p>
          <p className="text-[10px] text-muted-foreground">
            123 Main Street, City, ST 12345
          </p>
          <p className="text-xs font-bold mt-1">$1,500/mo</p>
        </div>

        {/* Fields grouped by section */}
        {fields.length === 0 ? (
          <div className="text-center py-6 text-xs text-muted-foreground">
            Add fields to see the preview
          </div>
        ) : (
          Array.from(sections.entries()).map(([section, sectionFields]) => (
            <div key={section} className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">
                {SECTION_LABELS[section] || section}
              </p>
              <div className="space-y-2">
                {sectionFields.map((field, i) => (
                  <div key={i} className="space-y-1">
                    <p className="text-[11px] font-medium">
                      {field.label}
                      {field.required && (
                        <span className="text-red-500 ml-0.5">*</span>
                      )}
                    </p>
                    {renderMockInput(field)}
                    {field.helpText && (
                      <p className="text-[9px] text-muted-foreground">
                        {field.helpText}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        {/* Document requirements section */}
        {enabledDocs.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">
              Required Documents
            </p>
            <div className="space-y-1.5">
              {enabledDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-start gap-2 rounded-lg border p-2"
                >
                  <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium">
                      {doc.label}
                      {doc.required && (
                        <span className="text-red-500 ml-0.5">*</span>
                      )}
                    </p>
                    {doc.description && (
                      <p className="text-[9px] text-muted-foreground">
                        {doc.description}
                      </p>
                    )}
                  </div>
                  <Upload className="h-3 w-3 text-muted-foreground shrink-0 mt-1" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Signature section */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">
            Signature & Certification
          </p>
          <div className="rounded-lg border bg-muted/20 p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded border border-input" />
              <span className="text-[10px] text-muted-foreground">
                I agree to the terms
              </span>
            </div>
            <div className="h-4 rounded bg-background border" />
            <div className="h-12 rounded border-2 border-dashed border-input bg-background flex items-center justify-center">
              <div className="flex items-center gap-1 text-muted-foreground">
                <PenLine className="h-3 w-3" />
                <span className="text-[9px]">Draw signature</span>
              </div>
            </div>
          </div>
        </div>

        {/* Submit button mock */}
        <div className="pt-2">
          <div className="w-full rounded-lg bg-primary/80 py-2 text-center text-xs font-medium text-primary-foreground">
            Submit Application
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground pt-2 border-t">
          <FileText className="h-2.5 w-2.5" />
          <span>
            {fields.length} field{fields.length !== 1 ? "s" : ""} &middot;{" "}
            {enabledDocs.length} document{enabledDocs.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

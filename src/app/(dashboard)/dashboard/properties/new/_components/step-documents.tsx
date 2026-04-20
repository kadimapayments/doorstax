"use client";

import {
  DocumentUpload,
  type PropertyDocumentRecord,
  type PropertyDocumentType,
} from "@/components/ui/document-upload";
import { CheckSquare, Square, AlertCircle } from "lucide-react";
import type { WizardState } from "../_lib/wizard-state";

interface StepDocumentsProps {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
}

interface DocSection {
  type: PropertyDocumentType;
  label: string;
  helpText: string;
}

const SECTIONS: DocSection[] = [
  {
    type: "PLAN",
    label: "Site / floor plans",
    helpText:
      "Architectural or leasing plans showing unit layouts, floors, and parking.",
  },
  {
    type: "PERMIT",
    label: "Building permits & C of O",
    helpText:
      "Certificate of Occupancy, building permits, any open violations notices.",
  },
  {
    type: "CERTIFICATE",
    label: "Inspection certificates",
    helpText:
      "Fire / sprinkler, elevator, boiler, lead paint clearance, etc.",
  },
  {
    type: "INSURANCE",
    label: "Insurance declarations",
    helpText:
      "Current general liability / property declarations page. The underwriter will want to see coverage limits.",
  },
  {
    type: "APPRAISAL",
    label: "Appraisal",
    helpText: "Most recent appraisal or BPO, if available.",
  },
  {
    type: "TAX_BILL",
    label: "Property tax bill",
    helpText: "Most recent annual tax bill.",
  },
  {
    type: "OTHER",
    label: "Other supporting docs",
    helpText:
      "HAP contract (for Section 8), Rent Stabilization Association registration, etc.",
  },
];

export function StepDocuments({ state, update }: StepDocumentsProps) {
  if (!state.createdPropertyId) {
    return (
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium">Setting up your property…</p>
          <p className="text-xs text-muted-foreground mt-1">
            We need to save the property before we can attach documents. Go
            back one step and click Next again.
          </p>
        </div>
      </div>
    );
  }

  const byType = (type: PropertyDocumentType) =>
    state.documents.filter((d) => d.type === type);

  function handleSectionChange(
    type: PropertyDocumentType,
    next: PropertyDocumentRecord[]
  ) {
    // Replace the slice for this type with `next`.
    const others = state.documents.filter((d) => d.type !== type);
    update({ documents: [...others, ...next] });
  }

  return (
    <div className="space-y-5 rounded-xl border bg-card p-6">
      <div>
        <h2 className="text-lg font-semibold">Documents</h2>
        <p className="text-sm text-muted-foreground">
          Drop in whatever you have — the underwriter reviews these directly.
          More is better, but nothing here is strictly required to submit.
          PDFs, JPG/PNG, or iPhone HEIC photos all work. 25 MB max per file.
        </p>
      </div>

      <div className="grid gap-4">
        {SECTIONS.map((section) => (
          <div
            key={section.type}
            className="rounded-lg border bg-background p-4"
          >
            <DocumentUpload
              propertyId={state.createdPropertyId!}
              type={section.type}
              label={section.label}
              helpText={section.helpText}
              documents={byType(section.type)}
              onChange={(next) => handleSectionChange(section.type, next)}
            />
          </div>
        ))}
      </div>

      {state.documents.length === 0 && (
        <button
          type="button"
          onClick={() =>
            update({ acknowledgedNoDocuments: !state.acknowledgedNoDocuments })
          }
          className="flex items-start gap-2 text-xs text-muted-foreground hover:text-foreground"
        >
          {state.acknowledgedNoDocuments ? (
            <CheckSquare className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
          ) : (
            <Square className="h-4 w-4 flex-shrink-0 mt-0.5" />
          )}
          <span>
            I don&apos;t have any supporting documents right now. I understand
            the underwriter may request more info before approving.
          </span>
        </button>
      )}
    </div>
  );
}

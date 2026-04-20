"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  FileText,
  Upload,
  X,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export type PropertyDocumentType =
  | "PLAN"
  | "PERMIT"
  | "CERTIFICATE"
  | "INSURANCE"
  | "APPRAISAL"
  | "TAX_BILL"
  | "DEED"
  | "MORTGAGE"
  | "OTHER";

export interface PropertyDocumentRecord {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  type: PropertyDocumentType;
  label: string | null;
  uploadedAt: string | Date;
}

interface DocumentUploadProps {
  /** The property these documents belong to. */
  propertyId: string;
  /** The document type tag — PLAN, PERMIT, etc. */
  type: PropertyDocumentType;
  /** Section title shown above the uploader. */
  label: string;
  /** Help text explaining what goes here. */
  helpText?: string;
  /** Current list of uploaded documents for this type. */
  documents: PropertyDocumentRecord[];
  /** Called after a successful upload / delete so the parent can refetch. */
  onChange: (documents: PropertyDocumentRecord[]) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * DocumentUpload — multi-file uploader for a single PropertyDocument type.
 * POSTs each file as multipart/form-data to
 * `/api/properties/:propertyId/documents` and renders the returned rows.
 *
 * Accepts PDFs + common image types (HEIC included for iPhone photos).
 * 25 MB cap per file (architectural plans are chunky).
 */
export function DocumentUpload({
  propertyId,
  type,
  label,
  helpText,
  documents,
  onChange,
}: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    const next = [...documents];

    for (const file of Array.from(files)) {
      if (file.size > 25 * 1024 * 1024) {
        toast.error(`${file.name} is larger than 25 MB`);
        continue;
      }
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", type);

      try {
        const res = await fetch(
          `/api/properties/${propertyId}/documents`,
          {
            method: "POST",
            body: fd,
          }
        );
        const body = await res.json().catch(() => ({}));
        if (res.ok && body.document) {
          next.push(body.document);
        } else {
          toast.error(
            `Failed to upload ${file.name}: ${body.error || "Unknown error"}`
          );
        }
      } catch (err) {
        toast.error(
          `Failed to upload ${file.name}: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }

    onChange(next);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleRemove(docId: string) {
    try {
      const res = await fetch(
        `/api/properties/${propertyId}/documents?docId=${docId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        onChange(documents.filter((d) => d.id !== docId));
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || "Failed to delete");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  return (
    <div className="space-y-2">
      <div>
        <Label className="text-sm font-medium">{label}</Label>
        {helpText && (
          <p className="text-xs text-muted-foreground mt-0.5">{helpText}</p>
        )}
      </div>

      {documents.length > 0 && (
        <ul className="space-y-1.5">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {doc.mimeType.startsWith("image/") ? (
                  <ImageIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium truncate block hover:underline"
                    title={doc.fileName}
                  >
                    {doc.fileName}
                  </a>
                  <p className="text-[11px] text-muted-foreground">
                    {formatSize(doc.fileSize)}
                    {doc.label && <> · {doc.label}</>}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(doc.id)}
                className="text-muted-foreground hover:text-destructive flex-shrink-0"
                title="Remove"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className="inline-block">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,image/*,.heic,.heif"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
          disabled={uploading}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          asChild
          disabled={uploading}
        >
          <span className="cursor-pointer">
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5 mr-1.5" />
            )}
            {uploading ? "Uploading…" : "Upload"}
          </span>
        </Button>
      </label>
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, FileUp } from "lucide-react";

const DOC_TYPES = [
  { value: "APPLICATION", label: "Application" },
  { value: "ID", label: "ID / License" },
  { value: "INCOME", label: "Income verification" },
  { value: "BANK_STATEMENT", label: "Bank statement" },
  { value: "RENTERS_INSURANCE", label: "Renters insurance" },
  { value: "LEASE", label: "Lease" },
  { value: "OTHER", label: "Other" },
];

interface TenantDocumentUploadButtonProps {
  tenantProfileId: string;
  /** Optional visual size for the trigger button. */
  size?: "sm" | "default" | "lg";
  /** Optional label override — defaults to "Upload document". */
  label?: string;
  /** Ghost variant when placed inline in a heading. */
  variant?: "default" | "outline" | "ghost";
}

/**
 * Trigger + dialog for uploading a document onto a TenantProfile.
 * POSTs multipart/form-data to /api/tenants/[id]/documents, which
 * stashes the file in Vercel Blob and writes a TenantDocument row.
 *
 * On success calls `router.refresh()` so the tenant profile's server-
 * rendered Documents list re-fetches without a full page reload.
 */
export function TenantDocumentUploadButton({
  tenantProfileId,
  size = "sm",
  label = "Upload document",
  variant = "outline",
}: TenantDocumentUploadButtonProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState("OTHER");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  function reset() {
    setFile(null);
    setType("OTHER");
    setName("");
    setNotes("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleSubmit() {
    if (!file) {
      toast.error("Pick a file to upload");
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", type);
      if (name.trim()) fd.append("name", name.trim());
      if (notes.trim()) fd.append("notes", notes.trim());

      const res = await fetch(`/api/tenants/${tenantProfileId}/documents`, {
        method: "POST",
        body: fd,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error || "Upload failed");
        return;
      }
      toast.success("Document uploaded");
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        onClick={() => setOpen(true)}
      >
        <FileUp className="mr-2 h-4 w-4" />
        {label}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-primary" />
              Upload tenant document
            </DialogTitle>
            <DialogDescription>
              PDFs and images up to 25 MB. Stored in the tenant&apos;s file.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="file">File</Label>
              <Input
                ref={inputRef}
                id="file"
                type="file"
                accept=".pdf,image/*,.heic,.heif"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                disabled={loading}
              />
              {file && (
                <p className="text-[11px] text-muted-foreground">
                  {file.name} · {(file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="docType">Type</Label>
              <select
                id="docType"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={loading}
              >
                {DOC_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="docName">Display name (optional)</Label>
              <Input
                id="docName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={file?.name || "Defaults to filename"}
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="docNotes">Notes (optional)</Label>
              <textarea
                id="docNotes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Signed lease 2026-05-01"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={loading}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={loading || !file}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

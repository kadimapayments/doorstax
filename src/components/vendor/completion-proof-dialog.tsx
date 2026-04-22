"use client";

import { useRef, useState } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Camera,
  CheckCircle2,
  Loader2,
  X,
  Image as ImageIcon,
} from "lucide-react";

interface CompletionProofDialogProps {
  ticketId: string;
  /** True when the ticket is already RESOLVED and the vendor is uploading
   *  additional / follow-up proof. Changes copy + keeps status RESOLVED. */
  alreadyResolved?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: () => void;
}

/**
 * Vendor completion-proof dialog. Collects up to 10 photos (or PDFs —
 * some vendors scan receipts) + a short explanation of what was done.
 *
 * First successful submission on an IN_PROGRESS ticket automatically
 * transitions it to RESOLVED. Subsequent submissions (post-resolution)
 * just append to the proof bundle.
 */
export function CompletionProofDialog({
  ticketId,
  alreadyResolved = false,
  open,
  onOpenChange,
  onSubmitted,
}: CompletionProofDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  function reset() {
    setFiles([]);
    setNotes("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function onFilesPicked(fileList: FileList | null) {
    if (!fileList) return;
    const next = [...files];
    for (const f of Array.from(fileList)) {
      if (next.length >= 10) {
        toast.error("Up to 10 files per submission");
        break;
      }
      if (f.size > 15 * 1024 * 1024) {
        toast.error(`${f.name} is larger than 15 MB`);
        continue;
      }
      next.push(f);
    }
    setFiles(next);
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeFile(i: number) {
    setFiles(files.filter((_, idx) => idx !== i));
  }

  async function handleSubmit() {
    if (files.length === 0 && !notes.trim()) {
      toast.error("Add at least one photo OR a written explanation");
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      for (const f of files) fd.append("file", f);
      if (notes.trim()) fd.append("notes", notes.trim());
      const url =
        `/api/tickets/${ticketId}/completion-proof` +
        (alreadyResolved ? "?stayInProgress=1" : "");
      const res = await fetch(url, { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error || "Submission failed");
        return;
      }
      toast.success(
        body.transitionedToResolved
          ? "Completion proof submitted — ticket marked Resolved"
          : "Completion proof added"
      );
      reset();
      onOpenChange(false);
      onSubmitted?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Submission failed"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            {alreadyResolved ? "Add more completion proof" : "Submit completion proof"}
          </DialogTitle>
          <DialogDescription>
            {alreadyResolved
              ? "Add additional photos or notes to this resolved ticket."
              : "Photos and a short explanation of what you did. Submitting this marks the ticket Resolved."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label>Photos of completed work</Label>
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <div
                  key={i}
                  className="relative h-20 w-20 rounded-md border bg-muted/30 overflow-hidden"
                >
                  {f.type.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={URL.createObjectURL(f)}
                      alt={f.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="absolute top-1 right-1 rounded-full bg-background/80 p-0.5 hover:bg-destructive hover:text-white"
                    title="Remove"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <label className="h-20 w-20 rounded-md border border-dashed border-muted-foreground/40 flex items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5">
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*,.heic,.heif,application/pdf"
                  multiple
                  capture="environment"
                  onChange={(e) => onFilesPicked(e.target.files)}
                  className="hidden"
                  disabled={loading}
                />
                <Camera className="h-5 w-5 text-muted-foreground" />
              </label>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Up to 10 files, 15 MB each. Use your phone camera or pick from
              the library.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">What did you do?</Label>
            <textarea
              id="notes"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Replaced the faulty cartridge in the bathroom sink, ran water for 5 min, no more leak. Parts cost $32, labor 45 min."
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={loading}
            />
            <p className="text-[11px] text-muted-foreground">
              The PM and tenant will see this verbatim.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={loading || (files.length === 0 && !notes.trim())}
            className={alreadyResolved ? "" : "bg-emerald-600 hover:bg-emerald-700 text-white"}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            {alreadyResolved ? "Add to proof" : "Submit & mark resolved"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

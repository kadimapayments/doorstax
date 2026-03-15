"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DELETION_REASONS = [
  { value: "LEASE_ENDED", label: "Lease Ended" },
  { value: "EVICTION", label: "Eviction" },
  { value: "NON_PAYMENT", label: "Non-Payment" },
  { value: "VOLUNTARY_DEPARTURE", label: "Voluntary Departure" },
  { value: "POLICY_VIOLATION", label: "Policy Violation" },
  { value: "OTHER", label: "Other" },
];

interface DeleteTenantDialogProps {
  tenant: {
    id: string;
    name: string;
  };
  /** Controlled open state (optional) */
  open?: boolean;
  /** Controlled open change handler (optional) */
  onOpenChange?: (open: boolean) => void;
}

export function DeleteTenantDialog({
  tenant,
  open: controlledOpen,
  onOpenChange,
}: DeleteTenantDialogProps) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  function resetForm() {
    setReason("");
    setNotes("");
  }

  async function handleDelete() {
    if (!reason) {
      toast.error("Please select a reason");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/tenants/${tenant.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, notes: notes.trim() || undefined }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to remove tenant");
        setLoading(false);
        return;
      }

      toast.success(`${tenant.name} has been removed`);
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Remove Tenant
          </DialogTitle>
          <DialogDescription>
            This will remove <strong>{tenant.name}</strong> from their unit,
            cancel any active autopay, and terminate active leases. This action
            cannot be easily undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Reason *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {DELETION_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="delete-notes">Notes (optional)</Label>
            <textarea
              id="delete-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={3}
              className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading || !reason}
          >
            {loading ? "Removing..." : "Remove Tenant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

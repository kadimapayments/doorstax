"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Copy, KeyRound, AlertTriangle } from "lucide-react";

interface ResetPasswordDialogProps {
  tenant: { id: string; name: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResetPasswordDialog({
  tenant,
  open,
  onOpenChange,
}: ResetPasswordDialogProps) {
  const [step, setStep] = useState<"confirm" | "result">("confirm");
  const [loading, setLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState("");

  async function handleReset() {
    setLoading(true);
    try {
      const res = await fetch(`/api/tenants/${tenant.id}/reset-password`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to reset password");
        setLoading(false);
        return;
      }

      const data = await res.json();
      setTempPassword(data.tempPassword);
      setStep("result");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(tempPassword);
    toast.success("Password copied to clipboard");
  }

  function handleClose(v: boolean) {
    if (!v) {
      // Reset state on close
      setStep("confirm");
      setTempPassword("");
    }
    onOpenChange(v);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {step === "confirm" ? (
          <>
            <DialogHeader>
              <DialogTitle>Reset Tenant Password</DialogTitle>
              <DialogDescription>
                Generate a temporary password for <span className="font-medium text-foreground">{tenant.name}</span>.
                They will be required to set a new password on their next login.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-start gap-3 rounded-md bg-amber-500/10 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-sm text-amber-700 dark:text-amber-400">
                This will invalidate any existing temp password. The tenant can still use their original password until they log in with the temp one.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button onClick={handleReset} disabled={loading}>
                {loading ? "Generating..." : "Reset Password"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                Temporary Password Created
              </DialogTitle>
              <DialogDescription>
                Share this password with <span className="font-medium text-foreground">{tenant.name}</span>.
                It will only be shown once.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={tempPassword}
                  readOnly
                  className="font-mono text-lg tracking-wider"
                />
                <Button variant="outline" size="icon" onClick={handleCopy}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-destructive font-medium">
                This password will not be shown again. Copy it now.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => handleClose(false)}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SendNoticeDialogProps {
  targetUserId: string;
  targetName: string;
  /** Render a custom trigger instead of the default Bell button */
  trigger?: React.ReactNode;
  /** Controlled open state (optional) */
  open?: boolean;
  /** Controlled open change handler (optional) */
  onOpenChange?: (open: boolean) => void;
}

export function SendNoticeDialog({
  targetUserId,
  targetName,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: SendNoticeDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
  const [title, setTitle] = useState("Payment Reminder");
  const [message, setMessage] = useState("");
  const [amount, setAmount] = useState("");
  const [severity, setSeverity] = useState("warning");
  const [sending, setSending] = useState(false);

  function resetForm() {
    setTitle("Payment Reminder");
    setMessage("");
    setAmount("");
    setSeverity("warning");
  }

  async function handleSend() {
    if (!title.trim() || !message.trim()) return;
    setSending(true);

    try {
      const res = await fetch("/api/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId,
          type: "CUSTOM",
          title: title.trim(),
          message: message.trim(),
          amount: amount ? amount : null,
          severity,
        }),
      });

      if (res.ok) {
        setOpen(false);
        resetForm();
      }
    } catch {
      // Silently handle error
    } finally {
      setSending(false);
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
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button variant="ghost" size="sm">
              <Bell className="mr-1 h-3 w-3" />
              Notify
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Notice to {targetName}</DialogTitle>
          <DialogDescription>
            This notice will appear as a banner on their dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="notice-title">Title</Label>
            <Input
              id="notice-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Payment Reminder"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notice-message">Message</Label>
            <textarea
              id="notice-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Please remit your payment by the end of the month..."
              rows={3}
              className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="notice-amount">Amount (optional)</Label>
              <Input
                id="notice-amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            </div>

            <div className="space-y-2">
              <Label>Severity</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !title.trim() || !message.trim()}
          >
            {sending ? "Sending..." : "Send Notice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

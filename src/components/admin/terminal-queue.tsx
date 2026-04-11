"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Server, ExternalLink } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

interface QueueItem {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  pmId: string;
  pmName: string;
  pmEmail: string;
  companyName: string | null;
  propertyId: string | null;
  propertyName: string | null;
  propertyAddress: string | null;
  currentTerminalId: string | null;
}

export function TerminalQueue() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignTarget, setAssignTarget] = useState<QueueItem | null>(null);
  const [terminalId, setTerminalId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function fetchQueue() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/terminal-requests");
      if (res.ok) {
        const data = await res.json();
        setQueue(data.queue || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchQueue();
  }, []);

  async function handleAssign() {
    if (!assignTarget?.propertyId || !terminalId.trim()) {
      toast.error("Terminal ID is required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/terminal-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noticeId: assignTarget.id,
          propertyId: assignTarget.propertyId,
          terminalId: terminalId.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("Terminal assigned");
        setAssignTarget(null);
        setTerminalId("");
        fetchQueue();
      } else {
        toast.error(data.error || "Assignment failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Card className="border-border">
        <CardContent className="p-12 text-center">
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (queue.length === 0) {
    return (
      <Card className="border-border">
        <CardContent className="p-12 text-center">
          <Server className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium">No pending terminal requests</p>
          <p className="text-xs text-muted-foreground mt-1">
            New requests appear here when a PM creates a property after their
            merchant application is approved.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {queue.map((item) => (
          <Card key={item.id} className="border-border">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Server className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-sm">
                      {item.propertyName || "Unknown property"}
                    </h3>
                  </div>
                  {item.propertyAddress && (
                    <p className="text-xs text-muted-foreground">
                      {item.propertyAddress}
                    </p>
                  )}
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <div className="text-muted-foreground uppercase tracking-wider text-[10px]">
                        Manager
                      </div>
                      <div className="font-medium">{item.pmName}</div>
                      <div className="text-muted-foreground">
                        {item.pmEmail}
                      </div>
                    </div>
                    {item.companyName && (
                      <div>
                        <div className="text-muted-foreground uppercase tracking-wider text-[10px]">
                          Company
                        </div>
                        <div className="font-medium">{item.companyName}</div>
                      </div>
                    )}
                    <div>
                      <div className="text-muted-foreground uppercase tracking-wider text-[10px]">
                        Requested
                      </div>
                      <div className="font-medium">
                        {formatDate(item.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {item.propertyId && (
                    <a
                      href={`/admin/properties/${item.propertyId}`}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View
                    </a>
                  )}
                  <Button
                    size="sm"
                    onClick={() => {
                      setAssignTarget(item);
                      setTerminalId(item.currentTerminalId || "");
                    }}
                    disabled={!item.propertyId}
                  >
                    Assign Terminal
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog
        open={assignTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAssignTarget(null);
            setTerminalId("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Kadima Terminal</DialogTitle>
          </DialogHeader>
          {assignTarget && (
            <div className="space-y-4">
              <div className="text-sm">
                <div className="text-muted-foreground">Property</div>
                <div className="font-medium">{assignTarget.propertyName}</div>
              </div>
              <div className="text-sm">
                <div className="text-muted-foreground">Manager</div>
                <div>{assignTarget.pmName}</div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Terminal ID</label>
                <Input
                  value={terminalId}
                  onChange={(e) => setTerminalId(e.target.value)}
                  placeholder="e.g. T-1234567"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  This is the Kadima terminal/MID assigned to this property.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignTarget(null)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

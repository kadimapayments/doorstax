"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuditLogRow {
  id: string;
  action: string;
  actorId: string | null;
  metadata: unknown;
  createdAt: string | Date;
}

interface AuditLogTableProps {
  logs: AuditLogRow[];
  /** Whether to render open by default. Defaults to false. */
  defaultOpen?: boolean;
}

function fmt(d: string | Date) {
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Collapsible audit trail. Every lifecycle event on a recovery plan
 * writes one of these rows; surfacing them is the auditability story
 * the PM/admin/regulator needs without leaving the plan page.
 */
export function AuditLogTable({ logs, defaultOpen = false }: AuditLogTableProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen((o) => !o)}
        className="gap-1.5 -ml-2 text-muted-foreground"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        <Activity className="h-3.5 w-3.5" />
        Audit trail ({logs.length} event{logs.length === 1 ? "" : "s"})
      </Button>

      {open && (
        <div className="mt-2 space-y-2">
          {logs.length === 0 ? (
            <p className="text-xs text-muted-foreground">No audit events yet.</p>
          ) : (
            logs.map((log) => {
              const metadataString =
                log.metadata && typeof log.metadata === "object"
                  ? JSON.stringify(log.metadata, null, 2)
                  : null;
              return (
                <div
                  key={log.id}
                  className="rounded-lg border bg-muted/20 p-3 space-y-1"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-mono font-semibold">
                      {log.action.replace(/_/g, " ")}
                    </span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {fmt(log.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>
                      Actor: {log.actorId ? (
                        <span className="font-mono">{log.actorId.slice(0, 8)}…</span>
                      ) : (
                        <span>system</span>
                      )}
                    </span>
                  </div>
                  {metadataString && (
                    <pre
                      className={cn(
                        "text-[11px] bg-background rounded border p-2 overflow-x-auto",
                        "max-h-40"
                      )}
                    >
                      {metadataString}
                    </pre>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

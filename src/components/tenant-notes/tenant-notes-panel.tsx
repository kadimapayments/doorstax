"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Loader2,
  Pin,
  PinOff,
  Trash2,
  Send,
  StickyNote,
  LifeBuoy,
} from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface TenantNotesPanelProps {
  /** TenantProfile.id — REQUIRED for every note operation. */
  tenantId: string;
  /** When provided, notes created here are tagged as RECOVERY and linked
   *  to this plan. On the tenant profile this is omitted so notes default
   *  to GENERAL. */
  recoveryPlanId?: string;
  /** Filter behaviour:
   *   - undefined  → show all notes for the tenant (general + recovery)
   *   - "RECOVERY" → show only notes for this plan
   *   - "GENERAL"  → show only general notes (not used in current routes
   *                  but supported for future scoping) */
  scope?: "RECOVERY" | "GENERAL";
  /** Card title. */
  title?: string;
}

/**
 * Shared notes panel used on both the recovery plan detail page and the
 * tenant profile page. Posts / reads from /api/tenant-notes.
 *
 * On the plan page: pass `recoveryPlanId` + `scope="RECOVERY"` so the
 * panel only shows plan-scoped notes and creates them as RECOVERY.
 *
 * On the tenant profile: omit both and the panel shows everything for
 * the tenant. New notes default to GENERAL.
 */
export function TenantNotesPanel({
  tenantId,
  recoveryPlanId,
  scope,
  title,
}: TenantNotesPanelProps) {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = recoveryPlanId
        ? `?recoveryPlanId=${encodeURIComponent(recoveryPlanId)}`
        : `?tenantId=${encodeURIComponent(tenantId)}`;
      const res = await fetch(`/api/tenant-notes${qs}`);
      if (res.ok) {
        const body = await res.json();
        let rows: any[] = body.notes || [];
        if (scope === "RECOVERY") {
          rows = rows.filter((n) => n.source === "RECOVERY");
        } else if (scope === "GENERAL") {
          rows = rows.filter((n) => n.source === "GENERAL");
        }
        setNotes(rows);
      }
    } finally {
      setLoading(false);
    }
  }, [tenantId, recoveryPlanId, scope]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/tenant-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          content: content.trim(),
          source: recoveryPlanId ? "RECOVERY" : "GENERAL",
          recoveryPlanId: recoveryPlanId || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error || "Failed to save note");
        return;
      }
      setContent("");
      toast.success("Note added");
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function togglePin(id: string, current: boolean) {
    const res = await fetch(`/api/tenant-notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPinned: !current }),
    });
    if (res.ok) load();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this note?")) return;
    const res = await fetch(`/api/tenant-notes/${id}`, {
      method: "DELETE",
    });
    if (res.ok) load();
  }

  return (
    <Card className="border-border">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <StickyNote className="h-4 w-4" />
            {title || (recoveryPlanId ? "Plan notes" : "Notes & activity")}
          </h3>
          {!loading && (
            <span className="text-xs text-muted-foreground">
              {notes.length} {notes.length === 1 ? "note" : "notes"}
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-2">
          <textarea
            rows={2}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              recoveryPlanId
                ? "Add a note about this recovery plan…"
                : "Log a call, a message, a heads-up…"
            }
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={submitting}
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={submitting || !content.trim()}
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5 mr-1.5" />
              )}
              Add note
            </Button>
          </div>
        </form>

        {loading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : notes.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            No notes yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {notes.map((note) => (
              <li
                key={note.id}
                className={`rounded-lg border p-3 ${
                  note.isPinned ? "bg-amber-500/5 border-amber-500/30" : "bg-background"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-1">
                      <span className="font-medium text-foreground">
                        {note.author?.name || note.author?.email || "PM"}
                      </span>
                      <span>·</span>
                      <span>{new Date(note.createdAt).toLocaleString()}</span>
                      {note.source === "RECOVERY" && !recoveryPlanId && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1 text-primary">
                            <LifeBuoy className="h-3 w-3" />
                            Recovery plan
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => togglePin(note.id, note.isPinned)}
                      className="text-muted-foreground hover:text-amber-600 p-1"
                      title={note.isPinned ? "Unpin" : "Pin"}
                    >
                      {note.isPinned ? (
                        <PinOff className="h-3.5 w-3.5" />
                      ) : (
                        <Pin className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(note.id)}
                      className="text-muted-foreground hover:text-destructive p-1"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

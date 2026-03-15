"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Copy,
  Check,
  Plus,
  Trash2,
  ExternalLink,
  X,
  CalendarDays,
} from "lucide-react";

interface CalendarTokenItem {
  id: string;
  label: string;
  token: string;
  createdAt: string;
}

interface IcalSubscribeDialogProps {
  open: boolean;
  onClose: () => void;
}

export function IcalSubscribeDialog({ open, onClose }: IcalSubscribeDialogProps) {
  const [tokens, setTokens] = useState<CalendarTokenItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchTokens = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/calendar/token");
      if (res.ok) {
        setTokens(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchTokens();
  }, [open, fetchTokens]);

  const createToken = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/calendar/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Calendar Feed" }),
      });
      if (res.ok) {
        const newToken = await res.json();
        setTokens((prev) => [newToken, ...prev]);
      }
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  const revokeToken = async (id: string) => {
    try {
      const res = await fetch(`/api/calendar/token?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setTokens((prev) => prev.filter((t) => t.id !== id));
      }
    } catch {
      // ignore
    }
  };

  const copyUrl = (token: string) => {
    const url = `${window.location.origin}/api/calendar/feed/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Subscribe to Calendar</h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground">
            Add your DoorStax calendar to Google Calendar, Apple Calendar, or
            Outlook by subscribing to the iCal feed URL below.
          </p>

          {/* Instructions */}
          <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
            <p className="text-xs font-semibold text-foreground">How to subscribe:</p>
            <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-1">
              <li>Generate a feed link below</li>
              <li>Copy the URL</li>
              <li>
                In Google Calendar: Other calendars → From URL → Paste
              </li>
              <li>
                In Apple Calendar: File → New Calendar Subscription → Paste
              </li>
              <li>
                In Outlook: Add calendar → From internet → Paste
              </li>
            </ol>
          </div>

          {/* Token list */}
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-2">
              {tokens.map((t) => {
                const feedUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/api/calendar/feed/${t.token}`;
                const isCopied = copied === t.token;
                return (
                  <div
                    key={t.id}
                    className="flex items-center gap-2 rounded-lg border border-border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground">
                        {t.label}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground font-mono">
                        {feedUrl}
                      </p>
                    </div>
                    <button
                      onClick={() => copyUrl(t.token)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      title="Copy URL"
                    >
                      {isCopied ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => revokeToken(t.id)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition-colors"
                      title="Revoke"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}

              {tokens.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No active feed links. Generate one to get started.
                </p>
              )}
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={createToken}
            disabled={creating}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {creating ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Generate New Feed Link
          </button>
        </div>
      </div>
    </div>
  );
}

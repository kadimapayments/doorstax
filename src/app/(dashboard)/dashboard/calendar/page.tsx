"use client";

export const dynamic = "force-dynamic";

import { useState, useCallback } from "react";
import { CalendarGrid } from "@/components/calendar/calendar-grid";
import { IcalSubscribeDialog } from "@/components/calendar/ical-subscribe-dialog";
import type { CalendarEvent } from "@/lib/calendar-events";
import { CalendarDays, Rss } from "lucide-react";

const EVENT_TYPE_FILTERS: {
  key: string;
  label: string;
  color: string;
  dot: string;
}[] = [
  { key: "rent_due", label: "Rent Due", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", dot: "bg-blue-500" },
  { key: "lease_start", label: "Lease Start", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", dot: "bg-emerald-500" },
  { key: "lease_end", label: "Lease End", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", dot: "bg-amber-500" },
  { key: "inspection", label: "Inspections", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300", dot: "bg-purple-500" },
  { key: "ticket", label: "Tickets", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300", dot: "bg-orange-500" },
  { key: "expense", label: "Expenses", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300", dot: "bg-red-500" },
  { key: "payout", label: "Payouts", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", dot: "bg-emerald-500" },
  { key: "scheduled_payment", label: "Autopay", color: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300", dot: "bg-sky-500" },
];

export default function PmCalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [subscribeOpen, setSubscribeOpen] = useState(false);

  const fetchEvents = useCallback(async (start: Date, end: Date) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/calendar/events?start=${start.toISOString()}&end=${end.toISOString()}`
      );
      if (res.ok) {
        setEvents(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleFilter = (key: string) => {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filteredEvents = events.filter((e) => !hiddenTypes.has(e.type));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <CalendarDays className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
            <p className="text-sm text-muted-foreground">
              View rent due dates, leases, inspections, tickets, and payouts
            </p>
          </div>
        </div>
        <button
          onClick={() => setSubscribeOpen(true)}
          className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
        >
          <Rss className="h-4 w-4" />
          Subscribe
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {EVENT_TYPE_FILTERS.map((f) => {
          const active = !hiddenTypes.has(f.key);
          return (
            <button
              key={f.key}
              onClick={() => toggleFilter(f.key)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                active
                  ? f.color
                  : "bg-muted text-muted-foreground opacity-50"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${active ? f.dot : "bg-muted-foreground/30"}`}
              />
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Calendar */}
      <CalendarGrid
        events={filteredEvents}
        loading={loading}
        onRangeChange={fetchEvents}
      />

      {/* Subscribe Dialog */}
      <IcalSubscribeDialog
        open={subscribeOpen}
        onClose={() => setSubscribeOpen(false)}
      />
    </div>
  );
}

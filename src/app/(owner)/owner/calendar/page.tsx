"use client";

import { useState, useCallback } from "react";
import { CalendarGrid } from "@/components/calendar/calendar-grid";
import { IcalSubscribeDialog } from "@/components/calendar/ical-subscribe-dialog";
import type { CalendarEvent } from "@/lib/calendar-events";
import { CalendarDays, Rss } from "lucide-react";

const LEGEND: { label: string; dot: string }[] = [
  { label: "Payouts", dot: "bg-emerald-500" },
  { label: "Lease Start", dot: "bg-emerald-500" },
  { label: "Lease End", dot: "bg-amber-500" },
  { label: "Inspections", dot: "bg-purple-500" },
];

export default function OwnerCalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
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
              Payouts, lease milestones, and property inspections
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

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {LEGEND.map((l) => (
          <div key={l.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`h-2 w-2 rounded-full ${l.dot}`} />
            {l.label}
          </div>
        ))}
      </div>

      {/* Calendar */}
      <CalendarGrid
        events={events}
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

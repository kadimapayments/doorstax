"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/lib/calendar-events";
import { EventPopover } from "./event-popover";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from "lucide-react";

// ─── Color dot mapping ─────────────────────────────
const DOT_COLORS: Record<string, string> = {
  blue: "bg-blue-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
  sky: "bg-sky-500",
};

const CHIP_COLORS: Record<string, string> = {
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  purple: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  orange: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  red: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  sky: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
};

// ─── Helpers ───────────────────────────────────────
type View = "month" | "week" | "day";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

function getMonthGrid(year: number, month: number): Date[][] {
  const firstDay = new Date(year, month, 1);
  const startDate = startOfWeek(firstDay);

  const weeks: Date[][] = [];
  let current = new Date(startDate);

  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
    // Stop if we've passed the month and started a new week
    if (current.getMonth() !== month && current.getDay() === 0) break;
  }

  return weeks;
}

function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function eventsForDay(
  events: CalendarEvent[],
  day: Date
): CalendarEvent[] {
  return events.filter((e) => isSameDay(new Date(e.start), day));
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatHour(h: number): string {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

// ─── Props ─────────────────────────────────────────
interface CalendarGridProps {
  events: CalendarEvent[];
  loading?: boolean;
  onRangeChange: (start: Date, end: Date) => void;
}

// ─── Component ─────────────────────────────────────
export function CalendarGrid({
  events,
  loading,
  onRangeChange,
}: CalendarGridProps) {
  const [view, setView] = useState<View>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Compute visible range and notify parent
  const range = useMemo(() => {
    if (view === "month") {
      const grid = getMonthGrid(year, month);
      const start = grid[0][0];
      const lastWeek = grid[grid.length - 1];
      const end = lastWeek[6];
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    if (view === "week") {
      const days = getWeekDays(currentDate);
      const end = new Date(days[6]);
      end.setHours(23, 59, 59, 999);
      return { start: days[0], end };
    }
    // day
    const start = new Date(currentDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(currentDate);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }, [view, year, month, currentDate]);

  useEffect(() => {
    onRangeChange(range.start, range.end);
  }, [range]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigation
  const goToday = useCallback(() => setCurrentDate(new Date()), []);

  const goPrev = useCallback(() => {
    setCurrentDate((d) => {
      const next = new Date(d);
      if (view === "month") next.setMonth(next.getMonth() - 1);
      else if (view === "week") next.setDate(next.getDate() - 7);
      else next.setDate(next.getDate() - 1);
      return next;
    });
  }, [view]);

  const goNext = useCallback(() => {
    setCurrentDate((d) => {
      const next = new Date(d);
      if (view === "month") next.setMonth(next.getMonth() + 1);
      else if (view === "week") next.setDate(next.getDate() + 7);
      else next.setDate(next.getDate() + 1);
      return next;
    });
  }, [view]);

  // Click day in month view → switch to day view
  const handleDayClick = useCallback((day: Date) => {
    setCurrentDate(day);
    setView("day");
  }, []);

  // Event click
  const handleEventClick = useCallback(
    (e: React.MouseEvent, event: CalendarEvent) => {
      e.stopPropagation();
      if (selectedEvent?.id === event.id) {
        setSelectedEvent(null);
        setPopoverPos(null);
        return;
      }
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (containerRect) {
        let left = rect.left - containerRect.left + rect.width / 2;
        let top = rect.bottom - containerRect.top + 4;
        // Keep popover in bounds
        if (left + 288 > containerRect.width) left = containerRect.width - 290;
        if (left < 0) left = 4;
        if (top + 200 > containerRect.height) top = rect.top - containerRect.top - 204;
        setPopoverPos({ top, left });
      }
      setSelectedEvent(event);
    },
    [selectedEvent]
  );

  // Close popover on outside click
  useEffect(() => {
    const handler = () => {
      setSelectedEvent(null);
      setPopoverPos(null);
    };
    if (selectedEvent) {
      const timeout = setTimeout(() => {
        document.addEventListener("click", handler, { once: true });
      }, 0);
      return () => {
        clearTimeout(timeout);
        document.removeEventListener("click", handler);
      };
    }
  }, [selectedEvent]);

  // Header label
  const headerLabel = useMemo(() => {
    if (view === "month") {
      return currentDate.toLocaleString("en-US", {
        month: "long",
        year: "numeric",
      });
    }
    if (view === "week") {
      const days = getWeekDays(currentDate);
      const s = days[0];
      const e = days[6];
      if (s.getMonth() === e.getMonth()) {
        return `${s.toLocaleString("en-US", { month: "long" })} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`;
      }
      return `${s.toLocaleString("en-US", { month: "short" })} ${s.getDate()} – ${e.toLocaleString("en-US", { month: "short" })} ${e.getDate()}, ${e.getFullYear()}`;
    }
    return currentDate.toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }, [view, currentDate]);

  return (
    <div ref={containerRef} className="relative flex flex-col">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={goNext}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-muted transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={goToday}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
          >
            Today
          </button>
          <h2 className="ml-2 text-lg font-semibold text-foreground">
            {headerLabel}
          </h2>
          {loading && (
            <div className="ml-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          )}
        </div>

        <div className="flex items-center rounded-lg border border-border p-0.5">
          {(["month", "week", "day"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                view === v
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {view === "month" && (
        <MonthView
          year={year}
          month={month}
          events={events}
          onDayClick={handleDayClick}
          onEventClick={handleEventClick}
        />
      )}
      {view === "week" && (
        <WeekView
          currentDate={currentDate}
          events={events}
          onEventClick={handleEventClick}
        />
      )}
      {view === "day" && (
        <DayView
          currentDate={currentDate}
          events={events}
          onEventClick={handleEventClick}
        />
      )}

      {/* Popover */}
      {selectedEvent && popoverPos && (
        <div style={{ position: "absolute", top: popoverPos.top, left: popoverPos.left }}>
          <EventPopover
            event={selectedEvent}
            onClose={() => {
              setSelectedEvent(null);
              setPopoverPos(null);
            }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Month View ──────────────────────────────────
function MonthView({
  year,
  month,
  events,
  onDayClick,
  onEventClick,
}: {
  year: number;
  month: number;
  events: CalendarEvent[];
  onDayClick: (day: Date) => void;
  onEventClick: (e: React.MouseEvent, event: CalendarEvent) => void;
}) {
  const weeks = useMemo(() => getMonthGrid(year, month), [year, month]);

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/50">
        {DAYS.map((d) => (
          <div
            key={d}
            className="py-2 text-center text-xs font-semibold text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 divide-x divide-border">
          {week.map((day, di) => {
            const dayEvents = eventsForDay(events, day);
            const isCurrentMonth = day.getMonth() === month;
            const today = isToday(day);
            const maxVisible = 3;
            const overflow = dayEvents.length - maxVisible;

            return (
              <div
                key={di}
                onClick={() => onDayClick(day)}
                className={cn(
                  "min-h-[90px] cursor-pointer border-b border-border p-1.5 transition-colors hover:bg-muted/30",
                  !isCurrentMonth && "bg-muted/20"
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                      today
                        ? "bg-primary text-primary-foreground"
                        : isCurrentMonth
                        ? "text-foreground"
                        : "text-muted-foreground/50"
                    )}
                  >
                    {day.getDate()}
                  </span>
                </div>
                <div className="mt-1 space-y-0.5">
                  {dayEvents.slice(0, maxVisible).map((ev) => (
                    <button
                      key={ev.id}
                      onClick={(e) => onEventClick(e, ev)}
                      className={cn(
                        "flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[10px] font-medium leading-tight truncate transition-opacity hover:opacity-80",
                        CHIP_COLORS[ev.color] ?? "bg-gray-100 text-gray-700"
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 shrink-0 rounded-full",
                          DOT_COLORS[ev.color] ?? "bg-gray-500"
                        )}
                      />
                      <span className="truncate">{ev.title}</span>
                    </button>
                  ))}
                  {overflow > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDayClick(day);
                      }}
                      className="w-full text-left text-[10px] font-medium text-muted-foreground hover:text-foreground px-1"
                    >
                      +{overflow} more
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Week View ───────────────────────────────────
function WeekView({
  currentDate,
  events,
  onEventClick,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (e: React.MouseEvent, event: CalendarEvent) => void;
}) {
  const days = useMemo(() => getWeekDays(currentDate), [currentDate]);

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {/* Header row */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border bg-muted/50">
        <div />
        {days.map((d, i) => (
          <div key={i} className="py-2 text-center">
            <div className="text-[10px] font-semibold uppercase text-muted-foreground">
              {DAYS[d.getDay()]}
            </div>
            <div
              className={cn(
                "mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
                isToday(d)
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground"
              )}
            >
              {d.getDate()}
            </div>
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div className="max-h-[600px] overflow-y-auto">
        {HOURS.map((h) => (
          <div
            key={h}
            className="grid grid-cols-[60px_repeat(7,1fr)] divide-x divide-border border-b border-border"
          >
            <div className="py-2 pr-2 text-right text-[10px] text-muted-foreground">
              {formatHour(h)}
            </div>
            {days.map((day, di) => {
              const hourEvents = eventsForDay(events, day).filter((e) => {
                const eventHour = new Date(e.start).getHours();
                return eventHour === h;
              });
              return (
                <div key={di} className="relative min-h-[40px] p-0.5">
                  {hourEvents.map((ev) => (
                    <button
                      key={ev.id}
                      onClick={(e) => onEventClick(e, ev)}
                      className={cn(
                        "mb-0.5 flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[10px] font-medium leading-tight truncate transition-opacity hover:opacity-80",
                        CHIP_COLORS[ev.color] ?? "bg-gray-100 text-gray-700"
                      )}
                    >
                      <span className="truncate">{ev.title}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Day View ────────────────────────────────────
function DayView({
  currentDate,
  events,
  onEventClick,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (e: React.MouseEvent, event: CalendarEvent) => void;
}) {
  const dayEvents = useMemo(
    () => eventsForDay(events, currentDate),
    [events, currentDate]
  );

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {/* All-day / summary strip */}
      {dayEvents.length > 0 && (
        <div className="border-b border-border bg-muted/30 px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground">
            {dayEvents.length} event{dayEvents.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* Hourly grid */}
      <div className="max-h-[600px] overflow-y-auto">
        {HOURS.map((h) => {
          const hourEvents = dayEvents.filter(
            (e) => new Date(e.start).getHours() === h
          );
          return (
            <div
              key={h}
              className="grid grid-cols-[60px_1fr] divide-x divide-border border-b border-border"
            >
              <div className="py-3 pr-2 text-right text-xs text-muted-foreground">
                {formatHour(h)}
              </div>
              <div className="min-h-[48px] p-1">
                {hourEvents.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={(e) => onEventClick(e, ev)}
                    className={cn(
                      "mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium transition-opacity hover:opacity-80",
                      CHIP_COLORS[ev.color] ?? "bg-gray-100 text-gray-700"
                    )}
                  >
                    <span
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full",
                        DOT_COLORS[ev.color] ?? "bg-gray-500"
                      )}
                    />
                    <span className="truncate">{ev.title}</span>
                    <span className="ml-auto shrink-0 text-[10px] opacity-60">
                      {new Date(ev.start).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

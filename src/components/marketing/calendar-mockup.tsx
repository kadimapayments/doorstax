import { ChevronLeft, ChevronRight } from "lucide-react";

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// March 2026 starts on Sunday
const calendarDays = [
  [1, 2, 3, 4, 5, 6, 7],
  [8, 9, 10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19, 20, 21],
  [22, 23, 24, 25, 26, 27, 28],
  [29, 30, 31, 0, 0, 0, 0],
];

type DotColor = "blue" | "emerald" | "amber" | "purple" | "sky";

const eventDots: Record<number, DotColor[]> = {
  1: ["blue"],           // Rent Due
  2: ["emerald"],        // Payment received
  3: ["emerald"],
  5: ["purple"],         // Inspection
  10: ["blue", "emerald"],
  12: ["sky"],           // Autopay
  15: ["amber"],         // Lease expiring
  18: ["emerald"],
  20: ["purple"],
  25: ["emerald", "blue"],
  28: ["amber"],
  31: ["emerald"],
};

const dotColorMap: Record<DotColor, string> = {
  blue: "bg-blue-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  purple: "bg-purple-500",
  sky: "bg-sky-500",
};

const legend: { label: string; color: string }[] = [
  { label: "Rent Due", color: "bg-blue-500" },
  { label: "Paid", color: "bg-emerald-500" },
  { label: "Lease", color: "bg-amber-500" },
  { label: "Inspection", color: "bg-purple-500" },
];

export function CalendarMockup() {
  return (
    <div className="rounded-lg bg-bg-card border border-border/50 p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <ChevronLeft className="h-3 w-3 text-text-muted" />
          <ChevronRight className="h-3 w-3 text-text-muted" />
          <span className="text-xs font-semibold text-text-primary ml-1">March 2026</span>
        </div>
        <div className="flex gap-1">
          <span className="rounded px-1.5 py-0.5 text-[7px] font-medium bg-accent-purple text-white">Month</span>
          <span className="rounded px-1.5 py-0.5 text-[7px] font-medium text-text-muted">Week</span>
          <span className="rounded px-1.5 py-0.5 text-[7px] font-medium text-text-muted">Day</span>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-[8px] font-semibold text-text-muted py-0.5">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      {calendarDays.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7">
          {week.map((day, di) => {
            const dots = day > 0 ? eventDots[day] : undefined;
            const isToday = day === 12;
            return (
              <div
                key={di}
                className="flex flex-col items-center py-1 min-h-[28px]"
              >
                {day > 0 ? (
                  <>
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-medium ${
                        isToday
                          ? "bg-accent-purple text-white"
                          : "text-text-secondary"
                      }`}
                    >
                      {day}
                    </span>
                    {dots && (
                      <div className="flex gap-0.5 mt-0.5">
                        {dots.map((c, ci) => (
                          <span key={ci} className={`h-1 w-1 rounded-full ${dotColorMap[c]}`} />
                        ))}
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}

      {/* Legend */}
      <div className="flex gap-3 mt-2 pt-2 border-t border-border/30">
        {legend.map((l) => (
          <div key={l.label} className="flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${l.color}`} />
            <span className="text-[7px] text-text-muted">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

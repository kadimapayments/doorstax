"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { Calendar, Building2 } from "lucide-react";

export type DashboardPeriod = "this-month" | "last-month" | "ytd" | "all-time";

export const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  "this-month": "This month",
  "last-month": "Last month",
  "ytd": "Year to date",
  "all-time": "All time",
};

/**
 * Resolves a period slug to an [inclusive start, exclusive end] date range.
 * `null` for either side means "unbounded".
 */
export function resolvePeriod(period: DashboardPeriod): {
  start: Date | null;
  end: Date | null;
} {
  const now = new Date();
  if (period === "this-month") {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
    };
  }
  if (period === "last-month") {
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      end: new Date(now.getFullYear(), now.getMonth(), 1),
    };
  }
  if (period === "ytd") {
    return {
      start: new Date(now.getFullYear(), 0, 1),
      end: new Date(now.getFullYear() + 1, 0, 1),
    };
  }
  return { start: null, end: null };
}

type Property = { id: string; name: string; unitCount: number };

interface DashboardFiltersProps {
  period: DashboardPeriod;
  propertyId: string | null;
  properties: Property[];
}

/**
 * Top-of-dashboard filter bar. Writes to `?period=` and `?propertyId=` via
 * `router.replace`, so the server page re-renders with fresh numbers.
 */
export function DashboardFilters({
  period,
  propertyId,
  properties,
}: DashboardFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const update = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(search?.toString() || "");
      if (value && value !== "default") params.set(key, value);
      else params.delete(key);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, search]
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Period picker */}
      <div className="relative">
        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <select
          value={period}
          onChange={(e) => update("period", e.target.value)}
          className="rounded-lg border bg-background pl-9 pr-8 py-1.5 text-sm font-medium focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
        >
          {(Object.keys(PERIOD_LABELS) as DashboardPeriod[]).map((p) => (
            <option key={p} value={p}>
              {PERIOD_LABELS[p]}
            </option>
          ))}
        </select>
      </div>

      {/* Property filter */}
      {properties.length > 1 && (
        <div className="relative">
          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <select
            value={propertyId || ""}
            onChange={(e) => update("propertyId", e.target.value || null)}
            className="rounded-lg border bg-background pl-9 pr-8 py-1.5 text-sm font-medium focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer max-w-[220px] truncate"
          >
            <option value="">All properties ({properties.length})</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.unitCount ? ` · ${p.unitCount}u` : ""}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

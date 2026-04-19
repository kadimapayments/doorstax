/**
 * Shared period helpers for the dashboard filter bar. Server-safe — do
 * NOT import client-only utilities into this file. It's consumed by
 * both the client `DashboardFilters` component and the server-rendered
 * `dashboard/page.tsx`.
 */

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

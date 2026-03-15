"use client";

import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

export type SortDir = "asc" | "desc";

interface SortableHeaderProps {
  label: string;
  sortKey: string;
  currentSort: string | null;
  currentDir: SortDir;
  onSort: (key: string) => void;
  className?: string;
}

export function SortableHeader({
  label,
  sortKey,
  currentSort,
  currentDir,
  onSort,
  className = "",
}: SortableHeaderProps) {
  return (
    <th
      className={`px-4 py-2 font-medium cursor-pointer select-none hover:text-foreground transition-colors ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {currentSort === sortKey ? (
          currentDir === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-30" />
        )}
      </span>
    </th>
  );
}

/** Helper to toggle sort state */
export function toggleSort(
  key: string,
  currentSort: string | null,
  currentDir: SortDir
): { sort: string; dir: SortDir } {
  if (currentSort === key) {
    return { sort: key, dir: currentDir === "asc" ? "desc" : "asc" };
  }
  return { sort: key, dir: "asc" };
}

/** Generic sort comparator */
export function sortCompare<T>(
  a: T,
  b: T,
  key: string,
  dir: SortDir
): number {
  const aVal = (a as Record<string, unknown>)[key];
  const bVal = (b as Record<string, unknown>)[key];
  if (aVal == null && bVal == null) return 0;
  if (aVal == null) return 1;
  if (bVal == null) return -1;
  if (typeof aVal === "number" && typeof bVal === "number") {
    return dir === "asc" ? aVal - bVal : bVal - aVal;
  }
  if (aVal instanceof Date && bVal instanceof Date) {
    return dir === "asc"
      ? aVal.getTime() - bVal.getTime()
      : bVal.getTime() - aVal.getTime();
  }
  const aStr = String(aVal).toLowerCase();
  const bStr = String(bVal).toLowerCase();
  return dir === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
}

"use client";

/**
 * Skeleton placeholders used while data is loading.
 * Relies on the `.skeleton` animation defined in globals.css.
 */

export function SkeletonCard() {
  return (
    <div className="rounded-xl border bg-card p-5 space-y-3">
      <div className="skeleton h-4 w-1/3" />
      <div className="skeleton h-8 w-1/2" />
      <div className="skeleton h-3 w-2/3" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 py-3 border-b last:border-0">
      <div className="skeleton h-8 w-8 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-3 w-1/4" />
        <div className="skeleton h-3 w-1/2" />
      </div>
      <div className="skeleton h-6 w-16 rounded shrink-0" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-0">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

export function SkeletonStats({ count = 4 }: { count?: number }) {
  // Use Tailwind's standard grid cols, not dynamic string interpolation
  // (Tailwind can't JIT classes it hasn't seen at build time).
  const gridClass =
    count === 2
      ? "grid gap-4 grid-cols-1 sm:grid-cols-2"
      : count === 3
        ? "grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
        : count === 5
          ? "grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
          : count === 6
            ? "grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
            : "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";
  return (
    <div className={gridClass}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      <SkeletonStats count={4} />
      <div className="rounded-xl border bg-card p-5">
        <div className="skeleton h-5 w-1/4 mb-4" />
        <SkeletonTable rows={6} />
      </div>
    </div>
  );
}

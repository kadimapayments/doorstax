"use client";

import Link from "next/link";

interface OnboardingBannerProps {
  completedCount: number;
  totalSteps: number;
  trialDaysLeft: number | null;
}

export function OnboardingBanner({
  completedCount,
  totalSteps,
  trialDaysLeft,
}: OnboardingBannerProps) {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 sm:p-4 mb-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {/* Step indicators */}
          <div className="flex items-center gap-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={
                  "h-2.5 w-2.5 rounded-full " +
                  (i < completedCount ? "bg-primary" : "bg-muted")
                }
              />
            ))}
          </div>
          <span className="text-sm font-medium">
            {completedCount} of {totalSteps} steps completed
          </span>
          {trialDaysLeft !== null && (
            <span
              className={
                "text-sm " +
                (trialDaysLeft <= 2
                  ? "text-red-500 font-medium"
                  : trialDaysLeft <= 5
                    ? "text-amber-500"
                    : "text-muted-foreground")
              }
            >
              &middot; {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} left
              in trial
            </span>
          )}
        </div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-primary hover:underline whitespace-nowrap"
        >
          View checklist &rarr;
        </Link>
      </div>
    </div>
  );
}

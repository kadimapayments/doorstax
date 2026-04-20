"use client";

import { Check } from "lucide-react";

export interface WizardStep {
  id: number;
  label: string;
  shortLabel?: string;
}

interface WizardShellProps {
  steps: WizardStep[];
  current: number;
  furthestReached: number;
  onJumpTo: (stepId: number) => void;
  children: React.ReactNode;
}

/**
 * Wizard shell — top progress bar + body slot.
 *
 * Clicking a step chip jumps only as far back as the user has been;
 * jumping ahead of `furthestReached` is disabled (prevents skipping
 * required validation).
 */
export function WizardShell({
  steps,
  current,
  furthestReached,
  onJumpTo,
  children,
}: WizardShellProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 overflow-x-auto">
          {steps.map((step, idx) => {
            const isActive = step.id === current;
            const isDone = step.id < current;
            const isReachable = step.id <= furthestReached;
            return (
              <div key={step.id} className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => isReachable && onJumpTo(step.id)}
                  disabled={!isReachable}
                  className={
                    "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors " +
                    (isActive
                      ? "bg-primary text-primary-foreground"
                      : isDone
                        ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                        : isReachable
                          ? "bg-muted text-foreground hover:bg-muted/80"
                          : "bg-muted/40 text-muted-foreground cursor-not-allowed")
                  }
                >
                  <span
                    className={
                      "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold " +
                      (isActive
                        ? "bg-primary-foreground text-primary"
                        : isDone
                          ? "bg-emerald-500 text-white"
                          : "bg-background text-muted-foreground")
                    }
                  >
                    {isDone ? <Check className="h-3 w-3" /> : step.id}
                  </span>
                  <span className="whitespace-nowrap">
                    {step.shortLabel || step.label}
                  </span>
                </button>
                {idx < steps.length - 1 && (
                  <div
                    className={
                      "h-0.5 w-4 flex-shrink-0 " +
                      (step.id < current ? "bg-emerald-500" : "bg-muted")
                    }
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

interface WizardFooterProps {
  onBack?: () => void;
  onNext?: () => void;
  onSubmit?: () => void;
  backLabel?: string;
  nextLabel?: string;
  submitLabel?: string;
  backDisabled?: boolean;
  nextDisabled?: boolean;
  loading?: boolean;
  isFinal?: boolean;
}

export function WizardFooter({
  onBack,
  onNext,
  onSubmit,
  backLabel = "Back",
  nextLabel = "Next",
  submitLabel = "Submit for underwriter review",
  backDisabled,
  nextDisabled,
  loading,
  isFinal,
}: WizardFooterProps) {
  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      <button
        type="button"
        onClick={onBack}
        disabled={backDisabled || loading}
        className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        ← {backLabel}
      </button>
      {isFinal ? (
        <button
          type="button"
          onClick={onSubmit}
          disabled={nextDisabled || loading}
          className="btn-press rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "Submitting…" : submitLabel}
        </button>
      ) : (
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled || loading}
          className="btn-press rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {nextLabel} →
        </button>
      )}
    </div>
  );
}

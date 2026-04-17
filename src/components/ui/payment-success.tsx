"use client";

import { useEffect, useState } from "react";

interface PaymentSuccessProps {
  amount: string;
  onDone?: () => void;
  /** Optional receipt hint text. Defaults to email notification copy. */
  subtitle?: string;
}

/**
 * Animated overlay shown briefly after a successful payment.
 * 4 staged entries: scale-pop circle → checkmark draw → amount → receipt hint.
 * Calls `onDone` after ~3.5s so the caller can close the modal / navigate.
 */
export function PaymentSuccess({
  amount,
  onDone,
  subtitle = "A receipt has been sent to your email",
}: PaymentSuccessProps) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 300);
    const t2 = setTimeout(() => setStage(2), 800);
    const t3 = setTimeout(() => setStage(3), 1400);
    const t4 = setTimeout(() => onDone?.(), 3500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-scale-in">
      <div className="rounded-2xl bg-card border p-10 text-center max-w-sm mx-4">
        <div
          className={
            "mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full " +
            (stage >= 1 ? "bg-green-500/10 animate-scale-pop" : "opacity-0")
          }
        >
          <svg
            className="h-10 w-10 text-green-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 13l4 4L19 7" className={stage >= 1 ? "animate-draw-check" : ""} />
          </svg>
        </div>
        <div className={stage >= 2 ? "animate-fade-in-up" : "opacity-0"}>
          <p className="text-sm text-muted-foreground mb-1">Payment Successful</p>
          <p className="text-3xl font-bold text-green-500">{amount}</p>
        </div>
        <div className={stage >= 3 ? "animate-fade-in-up mt-4" : "opacity-0"}>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

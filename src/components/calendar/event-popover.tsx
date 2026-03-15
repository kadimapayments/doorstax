"use client";

import type { CalendarEvent } from "@/lib/calendar-events";
import { X } from "lucide-react";

const TYPE_BADGES: Record<string, { label: string; classes: string }> = {
  rent_due: { label: "Rent Due", classes: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  lease_start: { label: "Lease Start", classes: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  lease_end: { label: "Lease End", classes: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  inspection: { label: "Inspection", classes: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  ticket: { label: "Ticket", classes: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  expense: { label: "Expense", classes: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  payout: { label: "Payout", classes: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  scheduled_payment: { label: "Autopay", classes: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" },
};

interface EventPopoverProps {
  event: CalendarEvent;
  onClose: () => void;
}

export function EventPopover({ event, onClose }: EventPopoverProps) {
  const badge = TYPE_BADGES[event.type] ?? {
    label: event.type,
    classes: "bg-gray-100 text-gray-700",
  };

  const eventDate = new Date(event.start);
  const formattedDate = eventDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const formattedTime = eventDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const amount =
    event.meta?.amount != null
      ? `$${Number(event.meta.amount).toLocaleString()}`
      : null;

  const status = event.meta?.status
    ? String(event.meta.status).replace(/_/g, " ")
    : null;

  return (
    <div className="absolute z-50 w-72 rounded-lg border border-border bg-background shadow-lg">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-border p-3">
        <div className="min-w-0 flex-1">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.classes}`}
          >
            {badge.label}
          </span>
          <h4 className="mt-1.5 text-sm font-semibold leading-tight text-foreground">
            {event.title}
          </h4>
        </div>
        <button
          onClick={onClose}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="space-y-2 p-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">Date:</span>
          <span>{formattedDate}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">Time:</span>
          <span>{formattedTime}</span>
        </div>
        {amount && (
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">Amount:</span>
            <span className="font-semibold text-foreground">{amount}</span>
          </div>
        )}
        {status && (
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">Status:</span>
            <span className="capitalize">{status}</span>
          </div>
        )}
      </div>
    </div>
  );
}

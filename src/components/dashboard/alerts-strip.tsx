import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  FileText,
  LifeBuoy,
  Receipt,
  ChevronRight,
} from "lucide-react";

/**
 * Horizontal band below the hero cards. Each chip is clickable and
 * deep-links to the relevant list page. Chips with count === 0 are
 * hidden so the strip doesn't clutter when things are green.
 */
export interface AlertItem {
  kind: "overdue" | "expiringLeases" | "openTickets" | "pendingApps";
  count: number;
}

const META: Record<
  AlertItem["kind"],
  {
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    className: string;
  }
> = {
  overdue: {
    label: "overdue payment",
    href: "/dashboard/unpaid",
    icon: AlertTriangle,
    className:
      "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/15",
  },
  expiringLeases: {
    label: "expiring lease",
    href: "/dashboard/leases?expiring=week",
    icon: Clock,
    className:
      "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400 hover:bg-amber-500/15",
  },
  openTickets: {
    label: "open ticket",
    href: "/dashboard/tickets",
    icon: LifeBuoy,
    className:
      "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/15",
  },
  pendingApps: {
    label: "pending application",
    href: "/dashboard/applications",
    icon: FileText,
    className:
      "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/15",
  },
};

export function AlertsStrip({ alerts }: { alerts: AlertItem[] }) {
  const nonEmpty = alerts.filter((a) => a.count > 0);
  if (nonEmpty.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
        <Receipt className="h-4 w-4" />
        All clear — no overdue payments, expiring leases, open tickets, or
        pending applications.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {nonEmpty.map((a) => {
        const m = META[a.kind];
        const Icon = m.icon;
        const plural = a.count === 1 ? m.label : `${m.label}s`;
        return (
          <Link
            key={a.kind}
            href={m.href}
            className={
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors " +
              m.className
            }
          >
            <Icon className="h-3.5 w-3.5" />
            <span>
              <strong>{a.count}</strong> {plural}
            </span>
            <ChevronRight className="h-3 w-3 opacity-60" />
          </Link>
        );
      })}
    </div>
  );
}

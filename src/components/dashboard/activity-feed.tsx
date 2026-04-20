import Link from "next/link";
import {
  DollarSign,
  UserPlus,
  LifeBuoy,
  FileSignature,
  AlertCircle,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

/**
 * Recent activity feed for the PM dashboard. Server-rendered. Compact
 * list — not a card grid — with subtle dividers between rows.
 */
export interface ActivityEvent {
  id: string;
  kind:
    | "payment-received"
    | "payment-failed"
    | "tenant-added"
    | "ticket-created"
    | "lease-signed";
  label: string;
  detail?: string;
  amount?: number | null;
  when: Date;
  href?: string;
}

const KIND_META: Record<
  ActivityEvent["kind"],
  { icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  "payment-received": { icon: DollarSign, color: "text-emerald-500" },
  "payment-failed": { icon: AlertCircle, color: "text-red-500" },
  "tenant-added": { icon: UserPlus, color: "text-blue-500" },
  "ticket-created": { icon: LifeBuoy, color: "text-amber-500" },
  "lease-signed": { icon: FileSignature, color: "text-violet-500" },
};

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
        No recent activity yet.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card divide-y divide-border">
      {events.map((e) => {
        const Meta = KIND_META[e.kind];
        const Icon = Meta.icon;
        const content = (
          <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
            <span
              className={
                "flex h-8 w-8 items-center justify-center rounded-full bg-muted/40 flex-shrink-0 " +
                Meta.color
              }
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">{e.label}</p>
              {e.detail && (
                <p className="text-xs text-muted-foreground truncate">
                  {e.detail}
                </p>
              )}
            </div>
            <div className="text-right flex-shrink-0 flex flex-col items-end gap-0.5">
              {typeof e.amount === "number" && (
                <p
                  className={
                    "text-sm font-semibold " +
                    (e.kind === "payment-failed"
                      ? "text-red-500"
                      : "text-emerald-600")
                  }
                >
                  {formatCurrency(e.amount)}
                </p>
              )}
              <p className="text-[10px] text-muted-foreground">
                {timeAgo(e.when)}
              </p>
            </div>
          </div>
        );
        return e.href ? (
          <Link key={e.id} href={e.href} className="block">
            {content}
          </Link>
        ) : (
          <div key={e.id}>{content}</div>
        );
      })}
    </div>
  );
}

function timeAgo(when: Date): string {
  const ms = Date.now() - new Date(when).getTime();
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(when).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

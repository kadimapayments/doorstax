"use client";

import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency } from "@/lib/utils";
import {
  DollarSign,
  UserPlus,
  Building2,
} from "lucide-react";

interface RecentPayment {
  id: string;
  amount: number;
  status: string;
  type: string;
  tenantName: string;
  landlordName: string;
  property: string;
  unit: string;
  createdAt: string;
}

interface RecentUser {
  id: string;
  name: string;
  role: string;
  createdAt: string;
}

interface RecentActivityFeedProps {
  payments: RecentPayment[];
  users: RecentUser[];
}

type FeedItem =
  | { kind: "payment"; data: RecentPayment; at: number }
  | { kind: "user"; data: RecentUser; at: number };

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function RecentActivityFeed({
  payments,
  users,
}: RecentActivityFeedProps) {
  const feed: FeedItem[] = [
    ...payments.map(
      (p) =>
        ({ kind: "payment", data: p, at: new Date(p.createdAt).getTime() }) as FeedItem
    ),
    ...users.map(
      (u) =>
        ({ kind: "user", data: u, at: new Date(u.createdAt).getTime() }) as FeedItem
    ),
  ].sort((a, b) => b.at - a.at);

  if (feed.length === 0) {
    return (
      <Card className="border-border">
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">No recent activity.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardContent className="divide-y divide-border p-0">
        {feed.map((item) => {
          if (item.kind === "payment") {
            const p = item.data;
            return (
              <div
                key={`payment-${p.id}`}
                className="flex items-start gap-3 px-4 py-3"
              >
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{p.tenantName}</span>
                    {" paid "}
                    <span className="font-medium">
                      {formatCurrency(p.amount)}
                    </span>
                    {" to "}
                    <span className="font-medium">{p.landlordName}</span>
                  </p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3" />
                      {p.property} - {p.unit}
                    </span>
                    <StatusBadge
                      status={p.status}
                      className="text-[10px] px-1.5 py-0"
                    />
                  </div>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {relativeTime(p.createdAt)}
                </span>
              </div>
            );
          }

          const u = item.data;
          return (
            <div
              key={`user-${u.id}`}
              className="flex items-start gap-3 px-4 py-3"
            >
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
                <UserPlus className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-medium">{u.name}</span>
                  {" joined as "}
                  <span className="font-medium">
                    {u.role.charAt(0) + u.role.slice(1).toLowerCase()}
                  </span>
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {relativeTime(u.createdAt)}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

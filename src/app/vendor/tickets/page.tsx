"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonTable } from "@/components/ui/skeleton-loader";
import { Wrench, ExternalLink } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const STATUS_CLASS: Record<string, string> = {
  OPEN: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  IN_PROGRESS: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  RESOLVED: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  CLOSED: "bg-muted text-muted-foreground border-border",
};

const PRIORITY_CLASS: Record<string, string> = {
  LOW: "text-muted-foreground",
  MEDIUM: "text-blue-500",
  HIGH: "text-amber-500",
  URGENT: "text-red-500",
};

const STATUS_FILTERS = ["ALL", "OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function VendorTicketsPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");

  async function refresh() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      const res = await fetch("/api/vendor/tickets?" + params.toString());
      if (res.ok) {
        const body = await res.json();
        setTickets(body.tickets || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 page-enter">
      <div>
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          Service Tickets
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every work order assigned to you across your PM network.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={
              "rounded-full px-3 py-1 text-xs font-medium border transition-colors " +
              (statusFilter === s
                ? "bg-primary/10 text-primary border-primary/30"
                : "hover:bg-muted border-border")
            }
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {loading ? (
        <Card className="border-border">
          <CardContent className="p-5">
            <SkeletonTable rows={5} />
          </CardContent>
        </Card>
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={<Wrench className="h-12 w-12" />}
          title={statusFilter === "ALL" ? "No tickets yet" : `No ${statusFilter.toLowerCase().replace("_", " ")} tickets`}
          description={
            statusFilter === "ALL"
              ? "When a PM assigns you a service ticket it'll appear here. You'll also get notified by email."
              : "Try changing the filter above."
          }
        />
      ) : (
        <div className="grid gap-3 animate-stagger">
          {tickets.map((t) => (
            <Link
              key={t.id}
              href={`/vendor/tickets/${t.id}`}
              className="card-interactive block rounded-xl border border-border bg-card"
            >
              <div className="p-4 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{t.title}</p>
                    <Badge
                      variant="outline"
                      className={STATUS_CLASS[t.status] || STATUS_CLASS.OPEN}
                    >
                      {t.status.replace("_", " ")}
                    </Badge>
                    <span
                      className={
                        "text-xs font-medium " +
                        (PRIORITY_CLASS[t.priority] || PRIORITY_CLASS.MEDIUM)
                      }
                    >
                      {t.priority}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {t.description}
                  </p>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                    <span>
                      {t.landlord?.companyName || t.landlord?.name || "PM"}
                    </span>
                    <span>·</span>
                    <span>
                      {t.unit?.property?.name} — Unit {t.unit?.unitNumber}
                    </span>
                    <span>·</span>
                    <span>Opened {fmtDate(t.createdAt)}</span>
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

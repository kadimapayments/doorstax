"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ClipboardCheck,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  FileText,
  Users,
  ExternalLink,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonTable } from "@/components/ui/skeleton-loader";

/* eslint-disable @typescript-eslint/no-explicit-any */

const STATUSES = [
  { value: "", label: "Active queue (pending + needs info)" },
  { value: "PENDING_REVIEW", label: "Pending review" },
  { value: "NEEDS_INFO", label: "Needs info" },
  { value: "APPROVED", label: "Approved (history)" },
  { value: "REJECTED", label: "Rejected (history)" },
];

const STATUS_BADGE: Record<string, string> = {
  PENDING_REVIEW: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  NEEDS_INFO: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  APPROVED: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  REJECTED: "bg-red-500/10 text-red-600 border-red-500/20",
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AdminPropertyReviewsPage() {
  const [status, setStatus] = useState("");
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const qs = status ? `?status=${status}` : "";
      const res = await fetch(`/api/admin/property-reviews${qs}`);
      if (res.ok) {
        const body = await res.json();
        setQueue(body.queue || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <div className="space-y-6 page-enter">
      <PageHeader
        title="Property Reviews"
        description="Underwriter queue for newly-boarded properties. Approve to unlock live payments + terminal assignment, or ask for more info."
      />

      <div className="flex items-end gap-3">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            View
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border bg-background px-3 py-1.5 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="text-xs text-muted-foreground">
          {loading ? "…" : `${queue.length} property${queue.length === 1 ? "" : "ies"}`}
        </div>
      </div>

      {loading ? (
        <Card className="border-border">
          <CardContent className="p-5">
            <SkeletonTable rows={5} />
          </CardContent>
        </Card>
      ) : queue.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="h-12 w-12" />}
          title="Nothing in the queue"
          description={
            status
              ? "No properties match that filter."
              : "When PMs submit new properties for review they'll show up here."
          }
        />
      ) : (
        <Card className="border-border">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="text-left p-3">Property</th>
                    <th className="text-left p-3">PM</th>
                    <th className="text-right p-3">Units</th>
                    <th className="text-right p-3">Docs</th>
                    <th className="text-left p-3">Submitted</th>
                    <th className="text-center p-3">Status</th>
                    <th className="text-center p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b last:border-0 hover:bg-muted/20"
                    >
                      <td className="p-3">
                        <Link
                          href={`/admin/property-reviews/${row.id}`}
                          className="font-medium hover:underline"
                        >
                          {row.name}
                        </Link>
                        <div className="text-[11px] text-muted-foreground">
                          {row.address}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium">{row.pmName}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {row.pmEmail}
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="font-medium">{row.unitCount}</div>
                        {row.residentialUnitCount != null && (
                          <div className="text-[11px] text-muted-foreground">
                            {row.residentialUnitCount}R
                            {row.commercialUnitCount
                              ? ` / ${row.commercialUnitCount}C`
                              : ""}
                            {row.section8UnitCount
                              ? ` / ${row.section8UnitCount}s8`
                              : ""}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <FileText className="h-3 w-3 text-muted-foreground" />
                          {row.documentCount}
                        </div>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {fmtDate(row.submittedForReviewAt)}
                      </td>
                      <td className="p-3 text-center">
                        <Badge
                          variant="outline"
                          className={
                            STATUS_BADGE[row.boardingStatus] ||
                            STATUS_BADGE.PENDING_REVIEW
                          }
                        >
                          {row.boardingStatus === "PENDING_REVIEW" && (
                            <Clock className="h-3 w-3 mr-1" />
                          )}
                          {row.boardingStatus === "NEEDS_INFO" && (
                            <AlertCircle className="h-3 w-3 mr-1" />
                          )}
                          {row.boardingStatus === "APPROVED" && (
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                          )}
                          {row.boardingStatus === "REJECTED" && (
                            <XCircle className="h-3 w-3 mr-1" />
                          )}
                          {row.boardingStatus.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <Link
                          href={`/admin/property-reviews/${row.id}`}
                          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                          title="Review"
                        >
                          Review
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="text-xs text-muted-foreground flex items-center gap-2">
        <Users className="h-3 w-3" />
        Approval unlocks live payments, terminal assignment, and tier
        notifications for the PM.
      </div>
    </div>
  );
}

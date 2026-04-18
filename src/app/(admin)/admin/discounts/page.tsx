"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonTable } from "@/components/ui/skeleton-loader";
import {
  Percent,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Ban,
  ExternalLink,
} from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const STATUS_CLASS: Record<string, string> = {
  PENDING_APPROVAL: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  APPROVED: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  APPLIED: "bg-emerald-600/10 text-emerald-600 border-emerald-600/20",
  REJECTED: "bg-red-500/10 text-red-500 border-red-500/20",
  REVOKED: "bg-muted text-muted-foreground border-border",
};

const FILTERS = [
  "PENDING_APPROVAL",
  "APPROVED",
  "APPLIED",
  "REJECTED",
  "REVOKED",
  "ALL",
];

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtMoney(n: number | string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(n));
}

export default function AdminDiscountsPage() {
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("PENDING_APPROVAL");
  const [acting, setActing] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "ALL") params.set("status", filter);
      const res = await fetch("/api/admin/discounts?" + params.toString());
      if (res.ok) {
        const body = await res.json();
        setDiscounts(body.discounts || []);
        setCounts(body.counts || {});
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function act(id: string, action: "approve" | "reject" | "revoke", extra?: Record<string, unknown>) {
    setActing(id);
    try {
      const res = await fetch("/api/admin/discounts/" + id, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(
          action === "approve"
            ? "Discount approved"
            : action === "reject"
              ? "Discount rejected"
              : "Discount revoked"
        );
        setRejectingId(null);
        setRejectNote("");
        refresh();
      } else {
        toast.error(body.error || "Action failed");
      }
    } finally {
      setActing(null);
    }
  }

  const pendingCount = counts.PENDING_APPROVAL || 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 page-enter">
      <PageHeader
        title="Discount Approvals"
        description="Staff drafts credits and recurring discounts — admins approve or reject them here."
      />

      {pendingCount > 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 flex items-start gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">
              {pendingCount} discount request
              {pendingCount === 1 ? "" : "s"} waiting for approval
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Only SUPER_ADMIN / owner can approve.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((s) => {
          const count = s === "ALL" ? undefined : counts[s];
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={
                "rounded-full px-3 py-1 text-xs font-medium border transition-colors flex items-center gap-1.5 " +
                (filter === s
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "hover:bg-muted border-border")
              }
            >
              {s.replace(/_/g, " ")}
              {count !== undefined && count > 0 && (
                <span
                  className={
                    "rounded-full px-1.5 py-0 text-[10px] " +
                    (filter === s ? "bg-primary/20" : "bg-muted")
                  }
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <Card><CardContent className="p-5"><SkeletonTable rows={5} /></CardContent></Card>
      ) : discounts.length === 0 ? (
        <EmptyState
          icon={<Percent className="h-12 w-12" />}
          title={
            filter === "PENDING_APPROVAL"
              ? "Nothing waiting"
              : `No ${filter.toLowerCase().replace(/_/g, " ")} discounts`
          }
          description={
            filter === "PENDING_APPROVAL"
              ? "Staff can draft discount requests from a PM profile or the billing page."
              : "Change the filter above."
          }
        />
      ) : (
        <div className="grid gap-3 animate-stagger">
          {discounts.map((d) => {
            const isOneTime = d.type === "ONE_TIME_INVOICE";
            const canApprove = d.status === "PENDING_APPROVAL";
            const canRevoke = d.status === "APPROVED" || d.status === "APPLIED";
            return (
              <Card key={d.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold">
                          {isOneTime
                            ? `One-time credit ${fmtMoney(d.amount)}`
                            : `Recurring ${Number(d.amount).toFixed(2)}% off`}
                        </p>
                        <Badge
                          variant="outline"
                          className={
                            STATUS_CLASS[d.status] ||
                            STATUS_CLASS.PENDING_APPROVAL
                          }
                        >
                          {d.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                        <Link
                          href={`/admin/merchants/${d.targetUser.id}`}
                          className="hover:underline flex items-center gap-1"
                        >
                          {d.targetUser.companyName ||
                            d.targetUser.name ||
                            d.targetUser.email}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                        {d.invoice && (
                          <>
                            <span>·</span>
                            <span>
                              Invoice #{d.invoice.invoiceNumber} (
                              {d.invoice.period})
                            </span>
                          </>
                        )}
                        <span>·</span>
                        <span>
                          Requested by {d.requestedBy?.name || "Staff"}{" "}
                          {fmtDate(d.requestedAt)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                        {d.reason}
                      </p>
                      {d.rejectionNote && (
                        <p className="text-xs text-red-500 mt-1 whitespace-pre-wrap">
                          Rejected: {d.rejectionNote}
                        </p>
                      )}
                      {d.status === "APPROVED" && !isOneTime && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Active {fmtDate(d.startsAt)}
                          {d.endsAt ? ` → ${fmtDate(d.endsAt)}` : " onward"}
                        </p>
                      )}
                    </div>
                  </div>

                  {canApprove &&
                    (rejectingId === d.id ? (
                      <div className="space-y-2 border-t pt-3">
                        <label className="text-xs font-medium">
                          Reason for rejection *
                        </label>
                        <textarea
                          value={rejectNote}
                          onChange={(e) => setRejectNote(e.target.value)}
                          rows={2}
                          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setRejectingId(null);
                              setRejectNote("");
                            }}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-muted"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() =>
                              act(d.id, "reject", { rejectionNote: rejectNote })
                            }
                            disabled={acting === d.id || !rejectNote.trim()}
                            className="btn-press rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50 flex items-center gap-1.5"
                          >
                            {acting === d.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <XCircle className="h-3 w-3" />
                            )}
                            Reject
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2 border-t pt-3">
                        <button
                          onClick={() => {
                            setRejectingId(d.id);
                            setRejectNote("");
                          }}
                          disabled={acting === d.id}
                          className="btn-press rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <XCircle className="h-3 w-3" />
                          Reject
                        </button>
                        <button
                          onClick={() => act(d.id, "approve")}
                          disabled={acting === d.id}
                          className="btn-press rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {acting === d.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3" />
                          )}
                          Approve
                        </button>
                      </div>
                    ))}

                  {canRevoke && (
                    <div className="flex justify-end gap-2 border-t pt-3">
                      <button
                        onClick={() =>
                          confirm(
                            "Revoke this discount? Recurring discounts will stop applying immediately."
                          ) && act(d.id, "revoke")
                        }
                        disabled={acting === d.id}
                        className="btn-press rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {acting === d.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Ban className="h-3 w-3" />
                        )}
                        Revoke
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

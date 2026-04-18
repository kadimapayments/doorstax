"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonTable } from "@/components/ui/skeleton-loader";
import {
  Receipt,
  ExternalLink,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const STATUS_CLASS: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground border-border",
  SUBMITTED: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  UNDER_REVIEW: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  APPROVED: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  REJECTED: "bg-red-500/10 text-red-500 border-red-500/20",
  PAID: "bg-emerald-600/10 text-emerald-600 border-emerald-600/20",
  VOID: "bg-muted text-muted-foreground border-border",
};

const FILTERS = ["SUBMITTED", "APPROVED", "PAID", "REJECTED", "ALL"];

function fmtMoney(n: number | string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(n));
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function PmVendorInvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("SUBMITTED");
  const [acting, setActing] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "ALL") params.set("status", filter);
      const res = await fetch("/api/pm/vendor-invoices?" + params.toString());
      if (res.ok) {
        const body = await res.json();
        setInvoices(body.invoices || []);
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

  async function approve(id: string) {
    setActing(id);
    try {
      const res = await fetch("/api/pm/vendor-invoices/" + id, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("Invoice approved — linked to an expense");
        refresh();
      } else {
        toast.error(body.error || "Approval failed");
      }
    } finally {
      setActing(null);
    }
  }

  async function submitReject(id: string) {
    if (!rejectReason.trim()) {
      toast.error("Rejection reason is required");
      return;
    }
    setActing(id);
    try {
      const res = await fetch("/api/pm/vendor-invoices/" + id, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject",
          rejectionReason: rejectReason.trim(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("Invoice rejected");
        setRejectingId(null);
        setRejectReason("");
        refresh();
      } else {
        toast.error(body.error || "Rejection failed");
      }
    } finally {
      setActing(null);
    }
  }

  const submittedCount = counts.SUBMITTED || 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 page-enter">
      <div>
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Vendor Invoices
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and approve bills submitted by your vendor network. Approval
          creates an expense automatically.
        </p>
      </div>

      {submittedCount > 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 flex items-start gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">
              {submittedCount} invoice
              {submittedCount === 1 ? "" : "s"} waiting for review
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Vendors can&apos;t be paid until their invoice is approved.
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
              {s.replace("_", " ")}
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
        <Card className="border-border">
          <CardContent className="p-5">
            <SkeletonTable rows={5} />
          </CardContent>
        </Card>
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-12 w-12" />}
          title={
            filter === "SUBMITTED"
              ? "No invoices waiting"
              : `No ${filter.toLowerCase().replace("_", " ")} invoices`
          }
          description={
            filter === "SUBMITTED"
              ? "When a vendor submits a bill, it'll appear here for your review."
              : "Switch filters to find what you're looking for."
          }
        />
      ) : (
        <div className="grid gap-3 animate-stagger">
          {invoices.map((i) => (
            <Card key={i.id} className="border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">
                        #{i.invoiceNumber}
                      </p>
                      <Badge
                        variant="outline"
                        className={
                          STATUS_CLASS[i.status] || STATUS_CLASS.SUBMITTED
                        }
                      >
                        {i.status.replace("_", " ")}
                      </Badge>
                      <span className="text-base font-bold">
                        {fmtMoney(i.amount)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                      <Link
                        href={`/dashboard/vendors/${i.vendorId}`}
                        className="hover:underline flex items-center gap-1"
                      >
                        {i.vendor?.company || i.vendor?.name}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                      {i.ticket && (
                        <>
                          <span>·</span>
                          <Link
                            href={`/dashboard/tickets/${i.ticket.id}`}
                            className="hover:underline"
                          >
                            Ticket: {i.ticket.title}
                          </Link>
                        </>
                      )}
                      <span>·</span>
                      <span>Submitted {fmtDate(i.submittedAt)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                      {i.description}
                    </p>
                    {i.fileUrl && (
                      <a
                        href={i.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        View attachment <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {i.rejectionReason && (
                      <p className="text-xs text-red-500 mt-1 whitespace-pre-wrap">
                        Rejected: {i.rejectionReason}
                      </p>
                    )}
                  </div>
                </div>

                {(i.status === "SUBMITTED" || i.status === "UNDER_REVIEW") && (
                  <>
                    {rejectingId === i.id ? (
                      <div className="space-y-2 border-t pt-3">
                        <label className="text-xs font-medium">
                          Reason for rejection *
                        </label>
                        <textarea
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          rows={2}
                          placeholder="Tell the vendor why this is being rejected…"
                          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setRejectingId(null);
                              setRejectReason("");
                            }}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-muted"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => submitReject(i.id)}
                            disabled={acting === i.id}
                            className="btn-press rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50 flex items-center gap-1.5"
                          >
                            {acting === i.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <XCircle className="h-3 w-3" />
                            )}
                            Reject invoice
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2 border-t pt-3">
                        <button
                          onClick={() => {
                            setRejectingId(i.id);
                            setRejectReason("");
                          }}
                          disabled={acting === i.id}
                          className="btn-press rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <XCircle className="h-3 w-3" />
                          Reject
                        </button>
                        <button
                          onClick={() => approve(i.id)}
                          disabled={acting === i.id}
                          className="btn-press rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {acting === i.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3" />
                          )}
                          Approve
                        </button>
                      </div>
                    )}
                  </>
                )}

                {i.status === "APPROVED" && (
                  <div className="border-t pt-3 text-xs text-muted-foreground flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Approved — expense created
                    </span>
                    <span>
                      Pay this vendor from{" "}
                      <Link
                        href="/dashboard/virtual-terminal"
                        className="text-primary hover:underline"
                      >
                        Virtual Terminal
                      </Link>
                    </span>
                  </div>
                )}

                {i.status === "PAID" && i.vendorPayout && (
                  <div className="border-t pt-3 text-xs text-muted-foreground flex items-center gap-1.5 text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Paid via{" "}
                    {(i.vendorPayout.method || "ach_credit").replace("_", " ")}
                    {i.vendorPayout.paidAt && (
                      <span className="text-muted-foreground">
                        {" "}
                        on {fmtDate(i.vendorPayout.paidAt)}
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

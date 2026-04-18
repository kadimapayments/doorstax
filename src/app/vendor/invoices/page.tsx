"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonTable } from "@/components/ui/skeleton-loader";
import { Receipt, Plus, ExternalLink } from "lucide-react";

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

const STATUS_FILTERS = ["ALL", "SUBMITTED", "APPROVED", "PAID", "REJECTED"];

function fmtMoney(n: number | string) {
  const v = Number(n);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(v);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function VendorInvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");

  async function refresh() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "ALL") params.set("status", filter);
      const res = await fetch("/api/vendor/invoices?" + params.toString());
      if (res.ok) {
        const body = await res.json();
        setInvoices(body.invoices || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 page-enter">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Invoices
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Invoices you&apos;ve submitted to PMs in your network.
          </p>
        </div>
        <Link
          href="/vendor/invoices/new"
          className="btn-press rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New invoice
        </Link>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={
              "rounded-full px-3 py-1 text-xs font-medium border transition-colors " +
              (filter === s
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
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-12 w-12" />}
          title={
            filter === "ALL"
              ? "No invoices yet"
              : `No ${filter.toLowerCase().replace("_", " ")} invoices`
          }
          description={
            filter === "ALL"
              ? "Submit your first invoice from any open ticket, or create a standalone bill."
              : "Try a different filter."
          }
          action={
            filter === "ALL" ? (
              <Link
                href="/vendor/invoices/new"
                className="btn-press rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                New invoice
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 animate-stagger">
          {invoices.map((i) => (
            <Link
              key={i.id}
              href={`/vendor/invoices/${i.id}`}
              className="card-interactive block rounded-xl border border-border bg-card"
            >
              <div className="p-4 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">
                      #{i.invoiceNumber}
                    </p>
                    <Badge
                      variant="outline"
                      className={STATUS_CLASS[i.status] || STATUS_CLASS.SUBMITTED}
                    >
                      {i.status.replace("_", " ")}
                    </Badge>
                    <span className="text-sm font-semibold">
                      {fmtMoney(i.amount)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {i.description}
                  </p>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                    <span>
                      {i.landlord?.companyName || i.landlord?.name || "PM"}
                    </span>
                    {i.ticket && (
                      <>
                        <span>·</span>
                        <span>Ticket: {i.ticket.title}</span>
                      </>
                    )}
                    <span>·</span>
                    <span>Submitted {fmtDate(i.submittedAt)}</span>
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

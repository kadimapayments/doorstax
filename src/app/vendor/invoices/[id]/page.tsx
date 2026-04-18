"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Receipt,
  FileText,
  Loader2,
  Trash2,
  User as UserIcon,
  Calendar,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

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

function fmtMoney(n: number | string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(n));
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function VendorInvoiceDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [voiding, setVoiding] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/vendor/invoices/" + id);
      if (res.ok) {
        setInvoice(await res.json());
      } else {
        toast.error("Could not load invoice");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleVoid() {
    if (!confirm("Void this invoice? This can't be undone.")) return;
    setVoiding(true);
    try {
      const res = await fetch("/api/vendor/invoices/" + id, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Invoice voided");
        router.push("/vendor/invoices");
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || "Void failed");
      }
    } finally {
      setVoiding(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-4">
        <div className="skeleton h-6 w-32" />
        <div className="skeleton h-48 rounded-xl" />
        <div className="skeleton h-32 rounded-xl" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <p className="text-sm text-muted-foreground">
          Invoice not found or you don&apos;t have access.
        </p>
      </div>
    );
  }

  const canVoid =
    invoice.status === "DRAFT" || invoice.status === "SUBMITTED";

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-4 page-enter">
      <button
        onClick={() => router.push("/vendor/invoices")}
        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to invoices
      </button>

      <Card className="border-border">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg md:text-xl font-bold flex items-center gap-2">
                  <Receipt className="h-5 w-5" />#{invoice.invoiceNumber}
                </h1>
                <Badge
                  variant="outline"
                  className={
                    STATUS_CLASS[invoice.status] || STATUS_CLASS.SUBMITTED
                  }
                >
                  {invoice.status.replace("_", " ")}
                </Badge>
              </div>
              <p className="text-2xl font-bold mt-2">
                {fmtMoney(invoice.amount)}
              </p>
            </div>
            {canVoid && (
              <button
                onClick={handleVoid}
                disabled={voiding}
                className="btn-press rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-500/10 disabled:opacity-50 flex items-center gap-2"
              >
                {voiding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Void
              </button>
            )}
          </div>

          <div className="pt-3 border-t space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <UserIcon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Property Manager</p>
                <p>
                  {invoice.landlord?.companyName ||
                    invoice.landlord?.name ||
                    "PM"}
                </p>
              </div>
            </div>
            {invoice.ticket && (
              <div className="flex items-start gap-2">
                <Receipt className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">
                    Service ticket
                  </p>
                  <p>{invoice.ticket.title}</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Submitted</p>
                <p>{fmtDateTime(invoice.submittedAt)}</p>
              </div>
            </div>
            {invoice.reviewedAt && (
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">
                    {invoice.status === "REJECTED" ? "Reviewed" : "Approved"}
                  </p>
                  <p>{fmtDateTime(invoice.reviewedAt)}</p>
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t">
            <p className="text-xs text-muted-foreground mb-1">Description</p>
            <p className="text-sm whitespace-pre-wrap">{invoice.description}</p>
          </div>

          {invoice.fileUrl && (
            <div className="pt-3 border-t">
              <p className="text-xs text-muted-foreground mb-1">Attachment</p>
              <a
                href={invoice.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <FileText className="h-4 w-4" />
                View uploaded invoice
              </a>
            </div>
          )}

          {invoice.status === "REJECTED" && invoice.rejectionReason && (
            <div className="pt-3 border-t">
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-red-500">Rejected</p>
                  <p className="text-xs mt-1 whitespace-pre-wrap">
                    {invoice.rejectionReason}
                  </p>
                </div>
              </div>
            </div>
          )}

          {invoice.reviewerNotes && (
            <div className="pt-3 border-t">
              <p className="text-xs text-muted-foreground mb-1">
                PM notes
              </p>
              <p className="text-sm whitespace-pre-wrap">
                {invoice.reviewerNotes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment status */}
      {invoice.vendorPayout && (
        <Card className="border-border">
          <CardContent className="p-5 space-y-2">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Payment
            </h2>
            <div className="text-sm space-y-1">
              <p className="text-xs text-muted-foreground">
                {invoice.vendorPayout.method?.replace("_", " ") || "ACH"} ·{" "}
                {invoice.vendorPayout.status}
              </p>
              {invoice.vendorPayout.paidAt && (
                <p className="text-xs text-muted-foreground">
                  Paid {fmtDateTime(invoice.vendorPayout.paidAt)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

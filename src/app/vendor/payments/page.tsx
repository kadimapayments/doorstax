"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonTable } from "@/components/ui/skeleton-loader";
import { Wallet } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const STATUS_CLASS: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground border-border",
  INITIATED: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  PAID: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  FAILED: "bg-red-500/10 text-red-500 border-red-500/20",
  CANCELED: "bg-muted text-muted-foreground border-border",
};

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

export default function VendorPaymentsPage() {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/vendor/payouts");
        if (res.ok) {
          const body = await res.json();
          setPayouts(body.payouts || []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const lifetimePaid = payouts
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 page-enter">
      <div>
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Payments received
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every ACH credit or manual payment sent to your bank account.
        </p>
      </div>

      {!loading && payouts.length > 0 && (
        <Card className="border-border">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Lifetime earnings</p>
            <p className="text-2xl md:text-3xl font-bold mt-1">
              {fmtMoney(lifetimePaid)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {payouts.filter((p) => p.status === "PAID").length}{" "}
              paid payment
              {payouts.filter((p) => p.status === "PAID").length === 1
                ? ""
                : "s"}
            </p>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card className="border-border">
          <CardContent className="p-5">
            <SkeletonTable rows={5} />
          </CardContent>
        </Card>
      ) : payouts.length === 0 ? (
        <EmptyState
          icon={<Wallet className="h-12 w-12" />}
          title="No payments yet"
          description="When a PM pays one of your approved invoices, you'll see the payout here with transaction details."
        />
      ) : (
        <div className="grid gap-3 animate-stagger">
          {payouts.map((p) => (
            <Card key={p.id} className="border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-base">
                        {fmtMoney(p.amount)}
                      </p>
                      <Badge
                        variant="outline"
                        className={STATUS_CLASS[p.status] || STATUS_CLASS.DRAFT}
                      >
                        {p.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {(p.method || "ach_credit").replace("_", " ")}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                      <span>
                        From{" "}
                        {p.landlord?.companyName ||
                          p.landlord?.name ||
                          "PM"}
                      </span>
                      {p.invoice && (
                        <>
                          <span>·</span>
                          <Link
                            href={`/vendor/invoices/${p.invoice.id}`}
                            className="hover:underline"
                          >
                            Invoice #{p.invoice.invoiceNumber}
                          </Link>
                        </>
                      )}
                      {p.paidAt && (
                        <>
                          <span>·</span>
                          <span>Paid {fmtDate(p.paidAt)}</span>
                        </>
                      )}
                    </div>
                    {p.memo && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {p.memo}
                      </p>
                    )}
                    {p.failedReason && (
                      <p className="text-xs text-red-500 mt-1">
                        {p.failedReason}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

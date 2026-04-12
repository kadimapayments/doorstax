"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Loader2, Download, Receipt, CreditCard } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const STATUS_CLASS: Record<string, string> = {
  PAID: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
  PENDING: "bg-amber-500/15 text-amber-500 border-amber-500/20",
  FAILED: "bg-red-500/15 text-red-500 border-red-500/20",
  WAIVED: "bg-blue-500/15 text-blue-500 border-blue-500/20",
  CREDITED: "bg-green-500/15 text-green-500 border-green-500/20",
};

export default function BillingPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/billing/invoices")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const sub = data?.subscription;
  const invoices = data?.invoices || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="Your subscription plan and invoice history."
      />

      {/* Current subscription */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                Plan
              </span>
            </div>
            <p className="text-lg font-bold">DoorStax Platform</p>
            <p className="text-xs text-muted-foreground mt-1">
              {data?.tierName || "Starter"} Tier &middot; {data?.unitCount || 0}{" "}
              units
            </p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
              Monthly Cost
            </div>
            <p className="text-2xl font-bold">
              {formatCurrency(data?.monthlyCost || 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              ${data?.perUnitRate?.toFixed(2) || "3.00"}/unit
            </p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
              Status
            </div>
            <Badge
              variant="outline"
              className={
                sub?.status === "ACTIVE"
                  ? "bg-emerald-500/15 text-emerald-500"
                  : sub?.status === "TRIALING"
                    ? "bg-amber-500/15 text-amber-500"
                    : "bg-zinc-500/15 text-zinc-400"
              }
            >
              {sub?.status || "No subscription"}
            </Badge>
            {sub?.trialEndsAt && (
              <p className="text-xs text-muted-foreground mt-2">
                Trial ends {formatDate(sub.trialEndsAt)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
              Next Billing
            </div>
            <p className="text-lg font-bold">
              {sub?.nextBillingDate
                ? formatDate(sub.nextBillingDate)
                : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Invoice history */}
      <Card className="border-border">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-base font-semibold">Invoice History</h3>
          </div>

          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No invoices yet. Your first invoice will be generated at your
              next billing date.
            </p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-4 py-2.5 text-left font-medium">
                      Invoice #
                    </th>
                    <th className="px-4 py-2.5 text-left font-medium">
                      Period
                    </th>
                    <th className="px-4 py-2.5 text-right font-medium">
                      Amount
                    </th>
                    <th className="px-4 py-2.5 text-right font-medium">
                      Credits
                    </th>
                    <th className="px-4 py-2.5 text-right font-medium">
                      Total
                    </th>
                    <th className="px-4 py-2.5 text-center font-medium">
                      Status
                    </th>
                    <th className="px-4 py-2.5 text-center font-medium">
                      Date
                    </th>
                    <th className="px-4 py-2.5 text-center font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv: any) => (
                    <tr
                      key={inv.id}
                      className="border-b last:border-0 hover:bg-muted/20"
                    >
                      <td className="px-4 py-3 font-mono text-xs">
                        {inv.invoiceNumber}
                      </td>
                      <td className="px-4 py-3">{inv.period}</td>
                      <td className="px-4 py-3 text-right">
                        {formatCurrency(inv.amount)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {inv.creditAmount > 0 ? (
                          <span className="text-green-600">
                            -{formatCurrency(inv.creditAmount)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatCurrency(inv.netAmount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant="outline"
                          className={
                            STATUS_CLASS[inv.status] || STATUS_CLASS.PENDING
                          }
                        >
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                        {formatDate(inv.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {inv.invoicePdfUrl && (
                          <a
                            href={inv.invoicePdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                          >
                            <Download className="h-3 w-3" />
                            PDF
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

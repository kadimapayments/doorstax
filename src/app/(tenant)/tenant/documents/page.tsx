"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Download, FileText, Shield, Receipt } from "lucide-react";

interface PaymentRow {
  id: string;
  amount: number;
  dueDate: string;
  paymentMethod: string | null;
  status: string;
  cardBrand?: string | null;
  cardLast4?: string | null;
  achLast4?: string | null;
}

export default function TenantDocumentsPage() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rentRecordMonths, setRentRecordMonths] = useState(12);

  useEffect(() => {
    fetch("/api/payments?status=COMPLETED&limit=10")
      .then((r) => r.json())
      .then((data) => {
        setPayments(Array.isArray(data) ? data : data.payments || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function formatCurrency(n: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(n);
  }

  function getMethodDisplay(p: PaymentRow): string {
    if (p.cardBrand && p.cardLast4) {
      return `${p.cardBrand.charAt(0).toUpperCase() + p.cardBrand.slice(1)} ···· ${p.cardLast4}`;
    }
    if (p.paymentMethod === "ach" && p.achLast4) {
      return `ACH ···· ${p.achLast4}`;
    }
    return p.paymentMethod?.toUpperCase() || "N/A";
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Documents"
        description="Download receipts and request certified documents."
      />

      {/* Payment Receipts */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            Payment Receipts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading payments...</p>
          ) : payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No completed payments found.
            </p>
          ) : (
            <div className="space-y-3">
              {payments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {formatCurrency(Number(p.amount))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(p.dueDate).toLocaleDateString()} &middot;{" "}
                      {getMethodDisplay(p)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      window.open(`/api/payments/${p.id}/receipt`, "_blank")
                    }
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Receipt
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Certified Rent Record */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Certified Rent Record
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Download a certified record of your rent payment history. This
            document can be used for mortgage applications, rental references,
            and credit verification purposes.
          </p>
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <Label>Period</Label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={rentRecordMonths}
                onChange={(e) => setRentRecordMonths(Number(e.target.value))}
              >
                <option value={6}>Last 6 months</option>
                <option value={12}>Last 12 months</option>
                <option value={24}>Last 24 months</option>
                <option value={36}>Last 36 months</option>
              </select>
            </div>
            <Button
              onClick={() =>
                window.open(
                  `/api/statements/rent-record?months=${rentRecordMonths}`,
                  "_blank"
                )
              }
            >
              <FileText className="mr-1.5 h-4 w-4" />
              Download Certified Record
            </Button>
          </div>
          <div className="rounded-lg border border-primary/10 bg-primary/5 p-4">
            <p className="text-xs text-muted-foreground">
              <strong>Use cases:</strong> Mortgage pre-approval, rental
              applications, landlord references, credit history verification,
              immigration documentation.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

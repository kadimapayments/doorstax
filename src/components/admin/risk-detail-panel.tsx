"use client";

import { useEffect, useState } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";
import { PaymentMethodBadge } from "@/components/ui/payment-method-badge";
import { Loader2 } from "lucide-react";

interface PaymentDetail {
  id: string;
  amount: number;
  surchargeAmount: number | null;
  paymentMethod: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  achLast4: string | null;
  status: string;
  type: string;
  description: string | null;
  dueDate: string;
  paidAt: string | null;
  createdAt: string;
  tenant: { name: string; email: string };
  landlord: { name: string; email: string };
  property: { name: string; address: string; city: string; state: string; zip: string };
  unit: string;
  tenantHistory: { id: string; amount: number; status: string; date: string; paymentMethod: string | null }[];
}

export function RiskDetailPanel({ paymentId }: { paymentId: string }) {
  const [data, setData] = useState<PaymentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/risk?paymentId=${paymentId}`)
      .then((res) => res.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [paymentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-muted-foreground py-4">Failed to load details.</p>;
  }

  return (
    <div className="bg-muted/30 rounded-lg p-4 space-y-4 border border-border/50">
      {/* Payment Info */}
      <div>
        <h4 className="text-sm font-semibold mb-2">Payment Details</h4>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <div><span className="text-muted-foreground">Amount:</span> {formatCurrency(data.amount)}</div>
          {data.surchargeAmount ? (
            <div><span className="text-muted-foreground">Surcharge:</span> {formatCurrency(data.surchargeAmount)}</div>
          ) : null}
          <div><span className="text-muted-foreground">Method:</span>{" "}
            <PaymentMethodBadge method={data.paymentMethod} cardBrand={data.cardBrand} cardLast4={data.cardLast4} achLast4={data.achLast4} />
          </div>
          <div><span className="text-muted-foreground">Type:</span> {data.type}</div>
          <div><span className="text-muted-foreground">Due:</span> {formatDate(new Date(data.dueDate))}</div>
          <div><span className="text-muted-foreground">Paid:</span> {data.paidAt ? formatDate(new Date(data.paidAt)) : "\u2014"}</div>
          {data.description ? (
            <div className="col-span-2"><span className="text-muted-foreground">Description:</span> {data.description}</div>
          ) : null}
        </div>
      </div>

      {/* Tenant + Property + Landlord */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <h4 className="text-sm font-semibold mb-1">Tenant</h4>
          <p className="text-sm">{data.tenant.name}</p>
          <p className="text-xs text-muted-foreground">{data.tenant.email}</p>
        </div>
        <div>
          <h4 className="text-sm font-semibold mb-1">Property</h4>
          <p className="text-sm">{data.property.name} — Unit {data.unit}</p>
          <p className="text-xs text-muted-foreground">{data.property.address}, {data.property.city}, {data.property.state} {data.property.zip}</p>
        </div>
        <div>
          <h4 className="text-sm font-semibold mb-1">Landlord</h4>
          <p className="text-sm">{data.landlord.name}</p>
          <p className="text-xs text-muted-foreground">{data.landlord.email}</p>
        </div>
      </div>

      {/* Tenant Payment History */}
      {data.tenantHistory.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2">Tenant Payment History (Last 10)</h4>
          <div className="rounded border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground">
                  <th className="text-left px-3 py-1.5 font-medium">Date</th>
                  <th className="text-left px-3 py-1.5 font-medium">Amount</th>
                  <th className="text-left px-3 py-1.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.tenantHistory.map((h) => (
                  <tr key={h.id} className="border-t border-border">
                    <td className="px-3 py-1.5">{formatDate(new Date(h.date))}</td>
                    <td className="px-3 py-1.5">{formatCurrency(h.amount)}</td>
                    <td className="px-3 py-1.5"><StatusBadge status={h.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

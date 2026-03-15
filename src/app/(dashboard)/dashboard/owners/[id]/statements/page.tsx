"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { formatCurrency } from "@/lib/utils";

interface Statement {
  id: string;
  period: string;
  grossRent: number;
  processingFees: number;
  managementFee: number;
  expenses: number;
  payoutFee: number;
  unitFee: number;
  netPayout: number;
  status: string;
  paidAt: string | null;
}

export default function OwnerStatementsPage() {
  const params = useParams();
  const [data, setData] = useState<{ owner: { name: string }; statements: Statement[] } | null>(null);

  useEffect(() => {
    fetch(`/api/owners/${params.id}/statements`)
      .then((r) => r.json())
      .then(setData);
  }, [params.id]);

  if (!data) return <div className="text-center py-12 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${data.owner.name} — Statements`}
        description="Monthly owner payout statements."
      />

      {data.statements.length === 0 ? (
        <p className="text-sm text-muted-foreground">No statements yet.</p>
      ) : (
        <div className="space-y-4">
          {data.statements.map((s) => (
            <div key={s.id} className="rounded-lg border border-border p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">{s.period}</h3>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  s.status === "PAID" ? "bg-emerald-500/10 text-emerald-600" :
                  s.status === "APPROVED" ? "bg-blue-500/10 text-blue-600" :
                  "bg-gray-500/10 text-gray-600"
                }`}>
                  {s.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-muted-foreground">Gross Rent</span>
                <span className="text-right">{formatCurrency(s.grossRent)}</span>
                <span className="text-muted-foreground">Payment Processing</span>
                <span className="text-right text-orange-500">-{formatCurrency(s.processingFees)}</span>
                <span className="text-muted-foreground">Management Fee</span>
                <span className="text-right text-orange-500">-{formatCurrency(s.managementFee)}</span>
                {s.expenses > 0 && (
                  <>
                    <span className="text-muted-foreground">Expenses</span>
                    <span className="text-right text-orange-500">-{formatCurrency(s.expenses)}</span>
                  </>
                )}
                {s.payoutFee > 0 && (
                  <>
                    <span className="text-muted-foreground">Payout Fee</span>
                    <span className="text-right text-orange-500">-{formatCurrency(s.payoutFee)}</span>
                  </>
                )}
                <span className="font-semibold border-t pt-2">Net Payout</span>
                <span className="text-right font-bold text-emerald-600 border-t pt-2">
                  {formatCurrency(s.netPayout)}
                </span>
              </div>
              {s.paidAt && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Paid on {new Date(s.paidAt).toLocaleDateString()}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

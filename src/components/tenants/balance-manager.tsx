"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Trash2, DollarSign, AlertTriangle } from "lucide-react";

interface PaymentItem {
  id: string;
  amount: number;
  type: string;
  status: string;
  description: string | null;
  dueDate: string;
  paidAt: string | null;
  paymentMethod: string | null;
  createdAt: string;
  expenseId?: string | null;
}

interface Props {
  tenantId: string;
  payments: PaymentItem[];
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function BalanceManager({ payments }: Props) {
  const [items, setItems] = useState(payments);
  const [voidingId, setVoidingId] = useState<string | null>(null);

  const completed = items.filter((p) => p.status === "COMPLETED");
  const pending = items.filter((p) => p.status === "PENDING");
  const failed = items.filter((p) => p.status === "FAILED");

  const totalPaid = completed.reduce((s, p) => s + p.amount, 0);
  const totalPending = pending.reduce((s, p) => s + p.amount, 0);
  const totalFailed = failed.reduce((s, p) => s + p.amount, 0);

  async function handleVoid(paymentId: string) {
    setVoidingId(paymentId);
    try {
      const res = await fetch(`/api/payments/${paymentId}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Written off by PM" }),
      });
      if (res.ok) {
        setItems((prev) => prev.map((p) => (p.id === paymentId ? { ...p, status: "REFUNDED" } : p)));
        toast.success("Payment voided");
      } else {
        toast.error("Failed to void");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setVoidingId(null);
    }
  }

  async function handleVoidAllFailed() {
    if (!confirm(`Void all ${failed.length} failed payments? This removes them from the outstanding balance.`)) return;
    for (const p of failed) {
      await handleVoid(p.id);
    }
  }

  if (pending.length === 0 && failed.length === 0) return null;

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          Balance Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3 text-center">
            <p className="text-xs text-muted-foreground">Paid</p>
            <p className="text-lg font-bold text-emerald-500">{formatMoney(totalPaid)}</p>
            <p className="text-xs text-muted-foreground">{completed.length} payment{completed.length !== 1 ? "s" : ""}</p>
          </div>
          <div className={cn("rounded-lg p-3 text-center border", totalPending > 0 ? "bg-amber-500/5 border-amber-500/20" : "bg-muted/50 border-border")}>
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <p className={cn("text-lg font-bold", totalPending > 0 ? "text-amber-500" : "")}>{formatMoney(totalPending)}</p>
            <p className="text-xs text-muted-foreground">{pending.length} charge{pending.length !== 1 ? "s" : ""}</p>
          </div>
          <div className={cn("rounded-lg p-3 text-center border", totalFailed > 0 ? "bg-red-500/5 border-red-500/20" : "bg-muted/50 border-border")}>
            <p className="text-xs text-muted-foreground">Failed</p>
            <p className={cn("text-lg font-bold", totalFailed > 0 ? "text-red-500" : "")}>{formatMoney(totalFailed)}</p>
            <p className="text-xs text-muted-foreground">{failed.length} attempt{failed.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        {/* Failed payments — offer to void */}
        {failed.length > 0 && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium">{failed.length} Failed Payment{failed.length !== 1 ? "s" : ""}</span>
              </div>
              <Button size="sm" variant="destructive" onClick={handleVoidAllFailed} disabled={!!voidingId}>
                <Trash2 className="mr-1 h-3 w-3" />
                Void All Failed
              </Button>
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {failed.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-xs py-1">
                  <span>
                    {p.expenseId ? (
                      <a href={`/dashboard/expenses?highlight=${p.expenseId}`} className="text-primary hover:underline">{p.description || p.type}</a>
                    ) : (
                      <>{p.description || p.type}</>
                    )}
                    {" — "}{fmtDate(p.createdAt)} — {formatMoney(p.amount)}
                  </span>
                  <button onClick={() => handleVoid(p.id)} disabled={voidingId === p.id} className="text-red-500 hover:underline disabled:opacity-50">
                    {voidingId === p.id ? "Voiding..." : "Void"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending charges */}
        {pending.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Outstanding Charges</p>
            {pending.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                <div>
                  {p.expenseId ? (
                    <a href={`/dashboard/expenses?highlight=${p.expenseId}`} className="font-medium text-primary hover:underline">{p.description || p.type}</a>
                  ) : (
                    <span className="font-medium">{p.description || p.type}</span>
                  )}
                  <span className="text-muted-foreground ml-1">— Due {fmtDate(p.dueDate)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{formatMoney(p.amount)}</span>
                  <button onClick={() => handleVoid(p.id)} disabled={voidingId === p.id} className="text-xs text-muted-foreground hover:text-red-500">
                    {voidingId === p.id ? "..." : "Void"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

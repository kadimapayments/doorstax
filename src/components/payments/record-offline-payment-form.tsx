"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  HandCoins,
  FileCheck,
  Loader2,
  CheckCircle2,
  Copy,
  DollarSign,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export interface OfflinePaymentTenantOption {
  tenantId: string;
  name: string;
  email: string | null;
  unitNumber: string;
  propertyName: string;
  rentAmount: number;
}

interface RecordOfflinePaymentFormProps {
  tenants: OfflinePaymentTenantOption[];
}

/**
 * PM-facing form to record a cash or check receipt. Submits to
 * `POST /api/payments/offline`, which reserves a receipt number,
 * creates the Payment row, and writes the corresponding ledger
 * entry — all atomically. On success we surface the receipt number
 * with a copy-to-clipboard button so the PM can hand it to the
 * tenant.
 */
export function RecordOfflinePaymentForm({
  tenants,
}: RecordOfflinePaymentFormProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "check">("cash");
  const [checkNumber, setCheckNumber] = useState("");
  const [dateReceived, setDateReceived] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{
    receiptNumber: string;
    paymentId: string;
  } | null>(null);

  const filteredTenants = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter((t) =>
      [t.name, t.email, t.unitNumber, t.propertyName]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q))
    );
  }, [search, tenants]);

  const selectedTenant = tenants.find((t) => t.tenantId === tenantId);

  function reset() {
    setSearch("");
    setTenantId("");
    setAmount("");
    setMethod("cash");
    setCheckNumber("");
    setDateReceived(new Date().toISOString().split("T")[0]);
    setNotes("");
    setSuccess(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId) {
      toast.error("Pick a tenant first");
      return;
    }
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.error("Enter a positive amount");
      return;
    }
    if (method === "check" && !checkNumber.trim()) {
      toast.error("Enter the check number");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/payments/offline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          amount: amt,
          method,
          dateReceived: new Date(dateReceived).toISOString(),
          notes: notes.trim() || undefined,
          checkNumber:
            method === "check" ? checkNumber.trim() : undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error || "Failed to record payment");
        return;
      }
      toast.success("Payment recorded");
      setSuccess({
        receiptNumber: body.receiptNumber,
        paymentId: body.paymentId,
      });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <h3 className="text-base font-semibold">Payment recorded</h3>
          </div>

          <div className="rounded-lg border bg-background p-4 space-y-2">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">
              Receipt number
            </div>
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              <span className="font-mono text-lg font-semibold">
                {success.receiptNumber}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(success.receiptNumber);
                  toast.success("Copied");
                }}
                className="ml-auto rounded-md border px-2 py-1 text-xs hover:bg-muted inline-flex items-center gap-1"
              >
                <Copy className="h-3 w-3" />
                Copy
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Hand this to the tenant — it&apos;s the audit-of-record for the
              cash/check. The tenant ledger has already been credited.
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={reset}>Record another</Button>
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard/tenants")}
            >
              Back to tenants
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Tenant picker */}
      <div className="space-y-2">
        <Label>Tenant</Label>
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by tenant name, email, unit, or property…"
          disabled={submitting}
        />
        <div className="max-h-48 overflow-y-auto rounded-lg border divide-y">
          {filteredTenants.length === 0 ? (
            <p className="text-xs text-muted-foreground p-4 text-center">
              {tenants.length === 0
                ? "No tenants on file."
                : "No tenants match that search."}
            </p>
          ) : (
            filteredTenants.slice(0, 50).map((t) => (
              <button
                key={t.tenantId}
                type="button"
                onClick={() => setTenantId(t.tenantId)}
                className={
                  "w-full text-left p-3 text-sm hover:bg-muted/50 transition-colors " +
                  (tenantId === t.tenantId
                    ? "bg-primary/5 border-l-2 border-primary"
                    : "")
                }
              >
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-muted-foreground">
                  {t.propertyName} — Unit {t.unitNumber}
                  {t.email ? ` · ${t.email}` : ""}
                </div>
              </button>
            ))
          )}
        </div>
        {selectedTenant && (
          <p className="text-xs text-muted-foreground">
            Monthly rent on file: ${selectedTenant.rentAmount.toLocaleString()}
          </p>
        )}
      </div>

      {/* Method */}
      <div className="space-y-2">
        <Label>Method</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMethod("cash")}
            disabled={submitting}
            className={
              "rounded-lg border p-4 text-sm flex items-center gap-2 transition-colors " +
              (method === "cash"
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "hover:bg-muted/50")
            }
          >
            <HandCoins className="h-4 w-4 text-emerald-600" />
            <span className="font-medium">Cash</span>
          </button>
          <button
            type="button"
            onClick={() => setMethod("check")}
            disabled={submitting}
            className={
              "rounded-lg border p-4 text-sm flex items-center gap-2 transition-colors " +
              (method === "check"
                ? "border-slate-500/40 bg-slate-500/10"
                : "hover:bg-muted/50")
            }
          >
            <FileCheck className="h-4 w-4 text-slate-500" />
            <span className="font-medium">Check</span>
          </button>
        </div>
      </div>

      {/* Amount + date */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount</Label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="pl-9"
              disabled={submitting}
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="dateReceived">Date received</Label>
          <Input
            id="dateReceived"
            type="date"
            value={dateReceived}
            onChange={(e) => setDateReceived(e.target.value)}
            disabled={submitting}
            required
          />
        </div>
      </div>

      {/* Check number — only when method=check */}
      {method === "check" && (
        <div className="space-y-2">
          <Label htmlFor="checkNumber">Check number</Label>
          <Input
            id="checkNumber"
            type="text"
            value={checkNumber}
            onChange={(e) => setCheckNumber(e.target.value)}
            placeholder="1234"
            disabled={submitting}
            required
          />
        </div>
      )}

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <textarea
          id="notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. April rent — paid in office"
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          disabled={submitting}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || !tenantId}>
          {submitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Receipt className="mr-2 h-4 w-4" />
          )}
          Record payment
        </Button>
      </div>
    </form>
  );
}

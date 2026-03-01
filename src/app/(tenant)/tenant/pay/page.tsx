"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "sonner";

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export default function PayRentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState<"ach" | "card">("ach");
  const [achAuthorized, setAchAuthorized] = useState(false);
  const [amount, setAmount] = useState("");
  const [rentInfo, setRentInfo] = useState<{
    rentAmount: number;
    splitPercent: number;
    myRent: number;
  } | null>(null);

  useEffect(() => {
    // Fetch tenant's rent info to pre-fill amount
    fetch("/api/tenants/me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          const myRent = data.rentAmount * data.splitPercent / 100;
          setRentInfo({
            rentAmount: data.rentAmount,
            splitPercent: data.splitPercent,
            myRent,
          });
          setAmount(myRent.toFixed(2));
        }
      })
      .catch(() => {/* ignore */});
  }, []);

  const numAmount = parseFloat(amount) || 0;
  const surcharge = method === "card" ? Math.round(numAmount * 0.0325 * 100) / 100 : 0;
  const totalCharge = numAmount + surcharge;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    const payload: Record<string, unknown> = {
      amount: numAmount,
      paymentMethod: method,
      unitId: "current",
    };

    if (method === "ach") {
      payload.routingNumber = formData.get("routingNumber");
      payload.accountNumber = formData.get("accountNumber");
      payload.accountType = formData.get("accountType");
      payload.achAuthorized = true;
    }

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Payment failed");
        setLoading(false);
        return;
      }

      toast.success("Payment submitted!");
      router.push("/tenant");
    } catch {
      toast.error("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Pay Rent" description="Make a one-time rent payment." />

      <Card className="max-w-lg border-border">
        <CardHeader>
          <CardTitle>Payment Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount ($)</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              {rentInfo && rentInfo.splitPercent < 100 && (
                <p className="text-xs text-muted-foreground">
                  Your split: {rentInfo.splitPercent}% of {formatMoney(rentInfo.rentAmount)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select
                value={method}
                onValueChange={(v) => {
                  setMethod(v as "ach" | "card");
                  setAchAuthorized(false);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ach">Bank Account (ACH) — No fee</SelectItem>
                  <SelectItem value="card">Credit/Debit Card — +3.25% fee</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Fee breakdown */}
            {numAmount > 0 && (
              <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Rent Amount</span>
                  <span>{formatMoney(numAmount)}</span>
                </div>
                {method === "card" && surcharge > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Card Processing Fee (3.25%)</span>
                    <span>+{formatMoney(surcharge)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-medium border-t border-border pt-1 mt-1">
                  <span>Total</span>
                  <span>{formatMoney(totalCharge)}</span>
                </div>
              </div>
            )}

            {method === "ach" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="routingNumber">Routing Number</Label>
                  <Input
                    id="routingNumber"
                    name="routingNumber"
                    placeholder="9 digits"
                    maxLength={9}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accountNumber">Account Number</Label>
                  <Input
                    id="accountNumber"
                    name="accountNumber"
                    placeholder="Account number"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Account Type</Label>
                  <Select name="accountType" defaultValue="checking">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="checking">Checking</SelectItem>
                      <SelectItem value="savings">Savings</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {method === "card" && (
              <div className="rounded-lg border border-border p-4 text-center text-sm text-muted-foreground">
                Card payments use Kadima Hosted Fields.
                <br />
                This will be integrated with the secure payment form.
              </div>
            )}

            {method === "ach" && (
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="achAuth"
                  checked={achAuthorized}
                  onChange={(e) => setAchAuthorized(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-border"
                />
                <label htmlFor="achAuth" className="text-sm text-muted-foreground">
                  I authorize the debiting of my bank account for the amount of{" "}
                  {formatMoney(totalCharge)} via ACH electronic transfer.
                </label>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading || (method === "ach" && !achAuthorized)}
            >
              {loading
                ? "Processing..."
                : `Pay ${formatMoney(totalCharge)}`}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

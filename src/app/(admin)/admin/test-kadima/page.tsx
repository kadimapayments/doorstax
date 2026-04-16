"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { Loader2, ShieldCheck, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function TestKadimaPage() {
  const [card, setCard] = useState({
    cardNumber: "",
    exp: "",
    cvv: "",
    name: "",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!card.cardNumber || !card.exp || !card.cvv) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/test-kadima/auth-void", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(card),
      });
      const data = await res.json();
      setResult(data);
      // Clear card data from state immediately after submit (defense in depth)
      setCard({ cardNumber: "", exp: "", cvv: "", name: "" });
    } catch (err: any) {
      setResult({ error: err?.message || "Request failed" });
    } finally {
      setLoading(false);
    }
  }

  const verdict = result?.summary?.verdict;
  const verdictColor =
    verdict?.startsWith("PASS")
      ? "text-emerald-500"
      : verdict?.startsWith("PARTIAL")
      ? "text-amber-500"
      : verdict?.startsWith("AUTH_DECLINED")
      ? "text-blue-500"
      : "text-red-500";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          Production Kadima — Auth + Void Test
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          $0.01 authorization, immediately voided. No funds settle. ADMIN-only diagnostic.
        </p>
      </div>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm space-y-1">
          <p className="font-medium">Use your own card.</p>
          <p className="text-muted-foreground">
            This hits the production Kadima gateway. The $0.01 hold is released
            immediately by the void. You may briefly see a $0.01 pending charge
            on your statement that disappears within 1-3 days.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border bg-card p-5 space-y-4">
        <div>
          <label className="text-sm font-medium">Card number</label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="cc-number"
            value={card.cardNumber}
            onChange={(e) =>
              setCard((p) => ({ ...p, cardNumber: e.target.value }))
            }
            placeholder="4111 1111 1111 1111"
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Expiry (MM/YY)</label>
            <input
              type="text"
              autoComplete="cc-exp"
              value={card.exp}
              onChange={(e) =>
                setCard((p) => ({ ...p, exp: e.target.value }))
              }
              placeholder="12/27"
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-sm font-medium">CVV</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="cc-csc"
              value={card.cvv}
              onChange={(e) =>
                setCard((p) => ({ ...p, cvv: e.target.value }))
              }
              placeholder="123"
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Cardholder name (optional)</label>
          <input
            type="text"
            autoComplete="cc-name"
            value={card.name}
            onChange={(e) => setCard((p) => ({ ...p, name: e.target.value }))}
            placeholder="Defaults to your account name"
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !card.cardNumber || !card.exp || !card.cvv}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            "Run $0.01 Auth + Void"
          )}
        </button>
      </form>

      {result && (
        <div className="rounded-xl border bg-card p-5 space-y-4">
          {result.summary && (
            <div className="flex items-start gap-2">
              {verdict?.startsWith("PASS") ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5" />
              ) : verdict?.startsWith("PARTIAL") ? (
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
              )}
              <div>
                <p className={"text-sm font-semibold " + verdictColor}>
                  {result.summary.verdict}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Auth approved: {String(result.summary.authApproved)} · Voided: {String(result.summary.voided)} · No funds moved: {String(result.summary.noFundsMoved)}
                </p>
              </div>
            </div>
          )}
          <details open>
            <summary className="text-sm font-medium cursor-pointer">Full response</summary>
            <pre className="mt-2 text-xs bg-muted/50 rounded-lg p-3 overflow-auto max-h-[400px]">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

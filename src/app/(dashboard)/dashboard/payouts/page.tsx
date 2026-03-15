"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SortableHeader, toggleSort, sortCompare, type SortDir } from "@/components/ui/sortable-header";
import {
  Send,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileBarChart,
} from "lucide-react";
import { toast } from "sonner";

interface Owner {
  id: string;
  name: string;
}

interface Payout {
  id: string;
  ownerId: string;
  periodStart: string;
  periodEnd: string;
  grossRent: number;
  processingFees: number;
  managementFee: number;
  expenses: number;
  platformFee: number;
  payoutFee: number;
  payoutFeeRate: number | null;
  unitFee: number;
  netPayout: number;
  status: string;
  paymentMethod: string | null;
  paidAt: string | null;
  owner: { id: string; name: string; email: string | null; terminalId: string | null; achTerminalId: string | null; properties?: { id: string; name: string }[] };
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
  APPROVED: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  PROCESSING: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  PAID: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  FAILED: "bg-red-500/10 text-red-600 dark:text-red-400",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getPeriodLabel(p: Payout) {
  const start = new Date(p.periodStart);
  const end = new Date(p.periodEnd);
  const monthName = start.toLocaleDateString("en-US", { month: "short" });
  const year = start.getFullYear();
  if (start.getDate() === 1 && end.getDate() <= 15) {
    return `${monthName} ${year} (1st–15th)`;
  }
  if (start.getDate() >= 16) {
    return `${monthName} ${year} (16th–${end.getDate()}th)`;
  }
  return `${monthName} ${year}`;
}

export default function PayoutsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth()); // 0-based for display, +1 for API
  const [year, setYear] = useState(now.getFullYear());
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: string) {
    const s = toggleSort(key, sortCol, sortDir);
    setSortCol(s.sort);
    setSortDir(s.dir);
  }

  function fetchPayouts() {
    setLoading(true);
    fetch("/api/payouts")
      .then((r) => r.json())
      .then(setPayouts)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchPayouts();
    fetch("/api/owners").then((r) => r.json()).then(setOwners);
  }, []);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  }

  async function generateForAll() {
    if (owners.length === 0) {
      toast.error("No owners to generate payouts for");
      return;
    }
    setGenerating(true);
    let success = 0;
    let failed = 0;
    for (const owner of owners) {
      try {
        const res = await fetch("/api/payouts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ownerId: owner.id, month: month + 1, year }),
        });
        if (res.ok) success++;
        else failed++;
      } catch {
        failed++;
      }
    }
    setGenerating(false);
    if (success > 0) toast.success(`Generated ${success} payout(s)`);
    if (failed > 0) toast.error(`${failed} payout(s) failed or already exist`);
    fetchPayouts();
  }

  async function handleApprove(id: string) {
    const res = await fetch(`/api/payouts/${id}/approve`, { method: "POST" });
    if (res.ok) {
      toast.success("Payout approved");
      fetchPayouts();
    } else {
      const data = await res.json();
      toast.error(data.error);
    }
  }

  async function handleMarkPaid(id: string) {
    const method = prompt("Payment method (manual, check, wire, ach):", "manual");
    if (!method) return;
    const res = await fetch(`/api/payouts/${id}/mark-paid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentMethod: method }),
    });
    if (res.ok) {
      toast.success("Payout marked as paid");
      fetchPayouts();
    } else {
      const data = await res.json();
      toast.error(data.error);
    }
  }

  // Filter payouts for selected month
  const filtered = payouts.filter((p) => {
    const d = new Date(p.periodStart);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  const totalGross = filtered.reduce((s, p) => s + p.grossRent, 0);
  const totalNet = filtered.reduce((s, p) => s + p.netPayout, 0);
  const totalFees = totalGross - totalNet;

  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    return [...filtered].sort((a, b) => {
      let aVal: unknown, bVal: unknown;
      switch (sortCol) {
        case "ownerName":
          aVal = a.owner?.name || "";
          bVal = b.owner?.name || "";
          break;
        case "grossRent":
          aVal = a.grossRent;
          bVal = b.grossRent;
          break;
        case "netPayout":
          aVal = a.netPayout;
          bVal = b.netPayout;
          break;
        case "status":
          aVal = a.status;
          bVal = b.status;
          break;
        default:
          return 0;
      }
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === "number" && typeof bVal === "number")
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return sortDir === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [filtered, sortCol, sortDir]);

  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Owner Payouts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate and manage monthly payouts to property owners
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/payouts/report"
            className="inline-flex items-center gap-2 rounded-lg border bg-card px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            <FileBarChart className="h-4 w-4" />
            Payout Report
          </Link>
          <button
            onClick={generateForAll}
            disabled={generating || owners.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {generating ? "Generating..." : "Generate Payouts"}
          </button>
        </div>
      </div>

      {/* Month Selector */}
      <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
        <button onClick={prevMonth} className="p-1.5 rounded hover:bg-muted transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold">{MONTHS[month]} {year}</span>
        <button onClick={nextMonth} className="p-1.5 rounded hover:bg-muted transition-colors">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Summary Cards */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border bg-card p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Gross Rent</p>
            <p className="text-xl font-bold mt-1">${fmt(totalGross)}</p>
          </div>
          <div className="rounded-xl border bg-card p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Fees</p>
            <p className="text-xl font-bold mt-1 text-orange-500">-${fmt(totalFees)}</p>
          </div>
          <div className="rounded-xl border bg-card p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Net Payouts</p>
            <p className="text-xl font-bold mt-1 text-emerald-500">${fmt(totalNet)}</p>
          </div>
        </div>
      )}

      {/* Payouts Table */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <Send className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Payouts for {MONTHS[month]} {year}</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Click &ldquo;Generate Payouts&rdquo; to calculate payouts for all owners this month.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <SortableHeader label="Owner" sortKey="ownerName" currentSort={sortCol} currentDir={sortDir} onSort={handleSort} className="px-4 py-3" />
                <th className="px-4 py-3 font-medium">Property</th>
                <th className="px-4 py-3 font-medium">TID</th>
                <th className="px-4 py-3 font-medium">Period</th>
                <SortableHeader label="Gross Rent" sortKey="grossRent" currentSort={sortCol} currentDir={sortDir} onSort={handleSort} className="px-4 py-3 text-right" />
                <th className="px-4 py-3 font-medium text-right">Fees</th>
                <SortableHeader label="Net Payout" sortKey="netPayout" currentSort={sortCol} currentDir={sortDir} onSort={handleSort} className="px-4 py-3 text-right" />
                <SortableHeader label="Status" sortKey="status" currentSort={sortCol} currentDir={sortDir} onSort={handleSort} className="px-4 py-3" />
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
                const totalDeductions = p.processingFees + p.managementFee + p.expenses + (p.platformFee || 0) + (p.payoutFee || 0) + (p.unitFee || 0);
                return (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/owners/${p.owner.id}`} className="hover:underline">
                        <p className="font-medium">{p.owner.name}</p>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {p.owner.properties?.map((prop) => (
                        <Link key={prop.id} href={`/dashboard/properties/${prop.id}`} className="block hover:underline hover:text-foreground">
                          {prop.name}
                        </Link>
                      )) || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-muted-foreground">
                        {p.owner.terminalId || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {getPeriodLabel(p)}
                    </td>
                    <td className="px-4 py-3 text-right">${fmt(p.grossRent)}</td>
                    <td className="px-4 py-3 text-right text-orange-500">-${fmt(totalDeductions)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                      ${fmt(p.netPayout)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColors[p.status] || ""}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-1.5 justify-end">
                        {p.status === "DRAFT" && (
                          <button onClick={() => handleApprove(p.id)} className="rounded px-2.5 py-1 text-xs font-medium bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors">
                            Approve
                          </button>
                        )}
                        {p.status === "APPROVED" && (
                          <button onClick={() => handleMarkPaid(p.id)} className="rounded px-2.5 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors">
                            Mark Paid
                          </button>
                        )}
                        <Link
                          href={`/dashboard/payouts/${p.id}`}
                          className="rounded px-2.5 py-1 text-xs font-medium bg-muted hover:bg-muted/80 transition-colors"
                        >
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

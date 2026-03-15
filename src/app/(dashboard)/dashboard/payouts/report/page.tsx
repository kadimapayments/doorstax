"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ArrowLeft,
  FileBarChart,
} from "lucide-react";

interface PayoutRow {
  id: string;
  ownerId: string;
  ownerName: string;
  properties: string[];
  grossRent: number;
  netPayout: number;
  processingFees: number;
  managementFee: number;
  expenses: number;
  platformFee: number;
  payoutFee: number;
  unitFee: number;
  status: string;
}

interface ReportData {
  period: { month: number; year: number };
  totalGross: number;
  totalFees: number;
  totalNet: number;
  statusCounts: Record<string, number>;
  payouts: PayoutRow[];
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
  APPROVED: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  PROCESSING: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  PAID: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  FAILED: "bg-red-500/10 text-red-600 dark:text-red-400",
};

export default function PayoutReportPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-indexed
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  function prevMonth() {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  }

  function nextMonth() {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  }

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/payouts?month=${month}&year=${year}&format=json`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [month, year]);

  function downloadPdf() {
    window.open(
      `/api/reports/payouts?month=${month}&year=${year}&format=pdf`,
      "_blank"
    );
  }

  const fmt = (n: number) =>
    n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/payouts"
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Payout Report
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Consolidated monthly payout summary for all owners
            </p>
          </div>
        </div>
        <button
          onClick={downloadPdf}
          disabled={!data || data.payouts.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Download PDF
        </button>
      </div>

      {/* Month Selector */}
      <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold">
          {MONTHS[month - 1]} {year}
        </span>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded hover:bg-muted transition-colors"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading...
        </div>
      ) : !data || data.payouts.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <FileBarChart className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            No Payouts for {MONTHS[month - 1]} {year}
          </h3>
          <p className="text-sm text-muted-foreground">
            No payouts have been generated for this period yet.
          </p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border bg-card p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Gross Rent
              </p>
              <p className="text-xl font-bold mt-1">${fmt(data.totalGross)}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Total Fees
              </p>
              <p className="text-xl font-bold mt-1 text-orange-500">
                -${fmt(data.totalFees)}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Net Payouts
              </p>
              <p className="text-xl font-bold mt-1 text-emerald-500">
                ${fmt(data.totalNet)}
              </p>
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="flex items-center gap-3 flex-wrap">
            {Object.entries(data.statusCounts).map(([status, count]) => (
              <span
                key={status}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${statusColors[status] || ""}`}
              >
                {status}: {count}
              </span>
            ))}
          </div>

          {/* Payout Table */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium">Properties</th>
                  <th className="px-4 py-3 font-medium text-right">
                    Gross Rent
                  </th>
                  <th className="px-4 py-3 font-medium text-right">Fees</th>
                  <th className="px-4 py-3 font-medium text-right">
                    Net Payout
                  </th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.payouts.map((p) => {
                  const totalDeductions =
                    p.processingFees +
                    p.managementFee +
                    p.expenses +
                    (p.platformFee || 0) +
                    (p.payoutFee || 0) +
                    (p.unitFee || 0);
                  return (
                    <tr
                      key={p.id}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium">
                        <Link
                          href={`/dashboard/owners/${p.ownerId}`}
                          className="hover:underline"
                        >
                          {p.ownerName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {p.properties.join(", ") || "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        ${fmt(p.grossRent)}
                      </td>
                      <td className="px-4 py-3 text-right text-orange-500">
                        -${fmt(totalDeductions)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        ${fmt(p.netPayout)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColors[p.status] || ""}`}
                        >
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-muted/30 font-semibold">
                  <td className="px-4 py-3" colSpan={2}>
                    Total ({data.payouts.length} owners)
                  </td>
                  <td className="px-4 py-3 text-right">
                    ${fmt(data.totalGross)}
                  </td>
                  <td className="px-4 py-3 text-right text-orange-500">
                    -${fmt(data.totalFees)}
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">
                    ${fmt(data.totalNet)}
                  </td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

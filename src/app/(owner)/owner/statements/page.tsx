"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { FileText, Download, ChevronDown } from "lucide-react";

interface Statement {
  id: string;
  periodStart: string;
  periodEnd: string;
  grossRent: number;
  processingFees: number;
  managementFee: number;
  expenses: number;
  platformFee: number;
  payoutFee: number;
  unitFee: number;
  netPayout: number;
  status: string;
  paidAt: string | null;
  notes: string | null;
}

export default function OwnerStatementsPage() {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthFilter, setMonthFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/owner/statements")
      .then((r) => r.json())
      .then(setStatements)
      .finally(() => setLoading(false));
  }, []);

  // Build unique months from data
  const months = useMemo(() => {
    const set = new Set<string>();
    statements.forEach((s) => {
      const d = new Date(s.periodStart);
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    });
    return Array.from(set).sort().reverse();
  }, [statements]);

  const filtered = useMemo(() => {
    if (!monthFilter) return statements;
    return statements.filter((s) => {
      const d = new Date(s.periodStart);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return key === monthFilter;
    });
  }, [statements, monthFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Statements</h1>
          <p className="text-muted-foreground">
            Review your payout statements and deductions.
          </p>
        </div>
        {months.length > 0 && (
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All months</option>
            {months.map((m) => {
              const [y, mo] = m.split("-");
              const label = new Date(Number(y), Number(mo) - 1).toLocaleString(
                "en-US",
                { month: "long", year: "numeric" }
              );
              return (
                <option key={m} value={m}>
                  {label}
                </option>
              );
            })}
          </select>
        )}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-lg font-medium">No statements found</p>
            <p className="text-sm text-muted-foreground">
              {monthFilter
                ? "No statements for the selected month."
                : "Statements will appear here once your property manager processes payouts."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Payout Statements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="whitespace-nowrap pb-2 pr-4 font-medium">Period</th>
                    <th className="whitespace-nowrap pb-2 pr-4 font-medium">Gross Rent</th>
                    <th className="whitespace-nowrap pb-2 pr-4 font-medium">Deductions</th>
                    <th className="whitespace-nowrap pb-2 pr-4 font-medium">Net Payout</th>
                    <th className="whitespace-nowrap pb-2 pr-4 font-medium">Status</th>
                    <th className="whitespace-nowrap pb-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => {
                    const totalDeductions = s.processingFees + s.managementFee + s.expenses + s.platformFee + s.payoutFee + s.unitFee;
                    const isExpanded = expandedId === s.id;
                    return (
                      <tr key={s.id} className="border-b last:border-0 group">
                        <td className="whitespace-nowrap py-3 pr-4">
                          {formatDate(s.periodStart)} &ndash;{" "}
                          {formatDate(s.periodEnd)}
                        </td>
                        <td className="whitespace-nowrap py-3 pr-4">
                          {formatCurrency(s.grossRent)}
                        </td>
                        <td className="whitespace-nowrap py-3 pr-4">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : s.id)}
                            className="inline-flex items-center gap-1 text-red-600 hover:underline"
                          >
                            -{formatCurrency(totalDeductions)}
                            <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                          </button>
                          {isExpanded && (
                            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                              <div className="flex justify-between gap-6">
                                <span>Payment Processing</span>
                                <span className="text-red-600">-{formatCurrency(s.processingFees)}</span>
                              </div>
                              <div className="flex justify-between gap-6">
                                <span>Management Fee</span>
                                <span className="text-red-600">-{formatCurrency(s.managementFee)}</span>
                              </div>
                              {s.expenses > 0 && (
                                <div className="flex justify-between gap-6">
                                  <span>Expenses</span>
                                  <span className="text-red-600">-{formatCurrency(s.expenses)}</span>
                                </div>
                              )}
                              {s.platformFee > 0 && (
                                <div className="flex justify-between gap-6">
                                  <span>Platform Fee</span>
                                  <span className="text-red-600">-{formatCurrency(s.platformFee)}</span>
                                </div>
                              )}
                              {s.payoutFee > 0 && (
                                <div className="flex justify-between gap-6">
                                  <span>Payout Fee</span>
                                  <span className="text-red-600">-{formatCurrency(s.payoutFee)}</span>
                                </div>
                              )}
                              {s.unitFee > 0 && (
                                <div className="flex justify-between gap-6">
                                  <span>Unit Fee</span>
                                  <span className="text-red-600">-{formatCurrency(s.unitFee)}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="whitespace-nowrap py-3 pr-4 font-semibold">
                          {formatCurrency(s.netPayout)}
                        </td>
                        <td className="whitespace-nowrap py-3 pr-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              s.status === "PAID"
                                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                : s.status === "DRAFT"
                                ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                : s.status === "APPROVED"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap py-3">
                          {s.status === "PAID" && (
                            <button
                              onClick={() => window.open(`/api/owner/statements/download?payoutId=${s.id}`, "_blank")}
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <Download className="h-3 w-3" />
                              PDF
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

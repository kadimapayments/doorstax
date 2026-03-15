"use client";

import { useState, useMemo } from "react";
import { MetricCard } from "@/components/ui/metric-card";
import { formatCurrency } from "@/lib/utils";
import { AlertTriangle, Ban, RotateCcw, ShieldAlert, Clock, UserX } from "lucide-react";
import { RiskTable, type RiskRow } from "@/components/admin/risk-table";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface RiskFilterWrapperProps {
  flaggedRows: RiskRow[];
  lateRows: RiskRow[];
  metrics: {
    failedPayments: number;
    refundedPayments: number;
    failedRate: string;
    lateCount: number;
    totalLateAmount: number;
    delinquentCount: number;
  };
  landlords: { id: string; name: string }[];
}

const severityOptions = ["ALL", "HIGH", "MEDIUM", "LOW"] as const;

export function RiskFilterWrapper({
  flaggedRows,
  lateRows,
  metrics,
  landlords,
}: RiskFilterWrapperProps) {
  const [landlordFilter, setLandlordFilter] = useState("ALL");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  const filterRows = (rows: RiskRow[]) =>
    rows.filter((r) => {
      const matchesLandlord =
        landlordFilter === "ALL" || r.landlord === landlordFilter;
      const matchesSeverity =
        severityFilter === "ALL" || r.severity === severityFilter;
      const matchesSearch =
        !search ||
        r.tenant.toLowerCase().includes(search.toLowerCase()) ||
        r.landlord.toLowerCase().includes(search.toLowerCase());
      return matchesLandlord && matchesSeverity && matchesSearch;
    });

  const filteredFlagged = useMemo(
    () => filterRows(flaggedRows),
    [flaggedRows, landlordFilter, severityFilter, search]
  );
  const filteredLate = useMemo(
    () => filterRows(lateRows),
    [lateRows, landlordFilter, severityFilter, search]
  );

  // Find landlord name for filter matching
  const landlordNames = useMemo(
    () => landlords.map((l) => l.name),
    [landlords]
  );

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          label="Failed Payments"
          value={metrics.failedPayments}
          icon={<Ban className="h-4 w-4" />}
        />
        <MetricCard
          label="Refunded"
          value={metrics.refundedPayments}
          icon={<RotateCcw className="h-4 w-4" />}
        />
        <MetricCard
          label="Failure Rate"
          value={`${metrics.failedRate}%`}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <MetricCard
          label="Late Payments"
          value={metrics.lateCount}
          icon={<Clock className="h-4 w-4" />}
        />
        <MetricCard
          label="Late Amount"
          value={formatCurrency(metrics.totalLateAmount)}
          icon={<ShieldAlert className="h-4 w-4" />}
        />
        <MetricCard
          label="Delinquent Tenants"
          value={metrics.delinquentCount}
          icon={<UserX className="h-4 w-4" />}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by tenant or landlord..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <select
          value={landlordFilter}
          onChange={(e) => setLandlordFilter(e.target.value)}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="ALL">All Managers</option>
          {landlordNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1 rounded-lg border border-border p-1">
          {severityOptions.map((s) => (
            <button
              key={s}
              onClick={() => setSeverityFilter(s)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                severityFilter === s
                  ? s === "HIGH"
                    ? "bg-red-500 text-white"
                    : s === "MEDIUM"
                    ? "bg-amber-500 text-white"
                    : s === "LOW"
                    ? "bg-blue-500 text-white"
                    : "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">
          Flagged Transactions ({filteredFlagged.length})
        </h2>
        <RiskTable rows={filteredFlagged} />
      </div>

      {filteredLate.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            Late Payments ({filteredLate.length})
          </h2>
          <RiskTable rows={filteredLate} />
        </div>
      )}
    </div>
  );
}

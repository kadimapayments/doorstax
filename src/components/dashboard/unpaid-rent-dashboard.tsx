"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MetricCard } from "@/components/ui/metric-card";
import { SendNoticeDialog } from "@/components/tenants/send-notice-dialog";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import {
  DollarSign,
  Users,
  Percent,
  AlertTriangle,
  Search,
  Bell,
  CreditCard,
  FileText,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  ExternalLink,
} from "lucide-react";

/* ── Types ─────────────────────────────────────────────────── */

interface UnpaidTenantRow {
  tenantId: string;
  userId: string;
  name: string;
  email: string;
  propertyId: string;
  propertyName: string;
  unitId: string;
  unitNumber: string;
  balance: number;
  monthlyRent: number;
  lastPaymentDate: string | null;
  oldestUnpaidPeriod: string;
  monthsOverdue: number;
  agingBucket: "CURRENT" | "30_PLUS" | "60_PLUS" | "90_PLUS";
  daysOverdue: number;
}

interface UnpaidSummary {
  totalUnpaid: number;
  delinquentCount: number;
  collectionRate: number;
  totalMonthlyRent: number;
  buckets: {
    current: number;
    thirtyPlus: number;
    sixtyPlus: number;
    ninetyPlus: number;
  };
}

interface UnpaidData {
  summary: UnpaidSummary;
  tenants: UnpaidTenantRow[];
}

type SortKey = "name" | "balance" | "monthlyRent" | "lastPaymentDate" | "monthsOverdue";
type SortDir = "asc" | "desc";

/* ── Aging Badge ───────────────────────────────────────────── */

const agingStyles: Record<string, string> = {
  CURRENT: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
  "30_PLUS": "bg-amber-500/15 text-amber-500 border-amber-500/20",
  "60_PLUS": "bg-orange-500/15 text-orange-500 border-orange-500/20",
  "90_PLUS": "bg-destructive/15 text-destructive border-destructive/20",
};

const agingLabels: Record<string, string> = {
  CURRENT: "Current",
  "30_PLUS": "30+ Days",
  "60_PLUS": "60+ Days",
  "90_PLUS": "90+ Days",
};

function AgingBadge({ bucket }: { bucket: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(agingStyles[bucket] || "", "font-medium text-xs")}
    >
      {agingLabels[bucket] || bucket}
    </Badge>
  );
}

/* ── Aging Bucket Card ─────────────────────────────────────── */

function AgingBucketCard({
  label,
  count,
  total,
  colorClass,
  isActive,
  onClick,
}: {
  label: string;
  count: number;
  total: number;
  colorClass: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <Card
      className={cn(
        "cursor-pointer border-border card-glow transition-all hover:shadow-md",
        isActive && "ring-2 ring-primary/50 border-primary/50"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div
          className={cn(
            "text-xs font-medium uppercase tracking-wider mb-2",
            colorClass
          )}
        >
          {label}
        </div>
        <p className="text-2xl font-bold">{count}</p>
        <p className="text-sm text-muted-foreground">
          {formatCurrency(total)} owed
        </p>
      </CardContent>
    </Card>
  );
}

/* ── Tenant Actions ────────────────────────────────────────── */

function TenantActions({ row }: { row: UnpaidTenantRow }) {
  return (
    <div
      className="flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      <SendNoticeDialog
        targetUserId={row.userId}
        targetName={row.name}
        trigger={
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            title="Send Reminder"
          >
            <Bell className="h-3.5 w-3.5" />
          </Button>
        }
      />
      <Link href={`/dashboard/payments/charge?tenantId=${row.tenantId}`}>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          title="Charge Tenant"
        >
          <CreditCard className="h-3.5 w-3.5" />
        </Button>
      </Link>
      <Link href={`/dashboard/tenants/${row.tenantId}#ledger`}>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          title="View Ledger"
        >
          <FileText className="h-3.5 w-3.5" />
        </Button>
      </Link>
    </div>
  );
}

/* ── Sortable Header ───────────────────────────────────────── */

function SortHeader({
  label,
  sortKey,
  currentSort,
  currentDir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  currentSort: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const isActive = currentSort === sortKey;
  return (
    <button
      onClick={() => onSort(sortKey)}
      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
    >
      {label}
      {isActive ? (
        currentDir === "asc" ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
}

/* ── Main Component ────────────────────────────────────────── */

export function UnpaidRentDashboard() {
  const [data, setData] = useState<UnpaidData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("");
  const [bucketFilter, setBucketFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("balance");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    fetch("/api/payments/unpaid")
      .then((r) => {
        if (r.ok) return r.json();
        return null;
      })
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  // Derive unique properties from data
  const propertyOptions = useMemo(() => {
    if (!data) return [];
    const seen = new Set<string>();
    return data.tenants
      .filter((t) => {
        if (seen.has(t.propertyId)) return false;
        seen.add(t.propertyId);
        return true;
      })
      .map((t) => ({ id: t.propertyId, name: t.propertyName }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  // Filter + sort
  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = data.tenants.filter((t) => {
      const matchSearch =
        !searchQuery ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.propertyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.unitNumber.toLowerCase().includes(searchQuery.toLowerCase());
      const matchProperty = !propertyFilter || t.propertyId === propertyFilter;
      const matchBucket = !bucketFilter || t.agingBucket === bucketFilter;
      return matchSearch && matchProperty && matchBucket;
    });

    // Sort
    rows = [...rows].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "balance":
          cmp = a.balance - b.balance;
          break;
        case "monthlyRent":
          cmp = a.monthlyRent - b.monthlyRent;
          break;
        case "lastPaymentDate":
          if (!a.lastPaymentDate && !b.lastPaymentDate) cmp = 0;
          else if (!a.lastPaymentDate) cmp = 1;
          else if (!b.lastPaymentDate) cmp = -1;
          else
            cmp =
              new Date(a.lastPaymentDate).getTime() -
              new Date(b.lastPaymentDate).getTime();
          break;
        case "monthsOverdue":
          cmp = a.monthsOverdue - b.monthsOverdue;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return rows;
  }, [data, searchQuery, propertyFilter, bucketFilter, sortKey, sortDir]);

  // Compute bucket totals from filtered data for bucket cards
  const bucketTotals = useMemo(() => {
    if (!data) return { current: 0, thirtyPlus: 0, sixtyPlus: 0, ninetyPlus: 0 };
    const totals: Record<string, number> = {
      CURRENT: 0,
      "30_PLUS": 0,
      "60_PLUS": 0,
      "90_PLUS": 0,
    };
    for (const t of data.tenants) {
      totals[t.agingBucket] = (totals[t.agingBucket] || 0) + t.balance;
    }
    return {
      current: totals.CURRENT,
      thirtyPlus: totals["30_PLUS"],
      sixtyPlus: totals["60_PLUS"],
      ninetyPlus: totals["90_PLUS"],
    };
  }, [data]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  function toggleBucketFilter(bucket: string) {
    setBucketFilter(bucketFilter === bucket ? "" : bucket);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (!data || data.tenants.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Unpaid Rent</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track outstanding balances across your portfolio.
          </p>
        </div>
        <Card className="border-border">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <DollarSign className="h-12 w-12 text-emerald-500 mb-3" />
            <h3 className="text-lg font-semibold">All Caught Up!</h3>
            <p className="text-sm text-muted-foreground mt-1">
              No tenants have outstanding balances. Great job!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { summary } = data;

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Unpaid Rent</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track outstanding balances across your portfolio.
          </p>
        </div>
        <Link
          href="/dashboard/payments"
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          View Payments
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* ── Summary Metrics ─────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-stagger">
        <MetricCard
          label="Total Unpaid"
          value={formatCurrency(summary.totalUnpaid)}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <MetricCard
          label="Delinquent Tenants"
          value={summary.delinquentCount}
          icon={<Users className="h-4 w-4" />}
        />
        <MetricCard
          label="Collection Rate"
          value={`${summary.collectionRate.toFixed(1)}%`}
          icon={<Percent className="h-4 w-4" />}
        />
        <MetricCard
          label="30+ Days Overdue"
          value={
            summary.buckets.thirtyPlus +
            summary.buckets.sixtyPlus +
            summary.buckets.ninetyPlus
          }
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>

      {/* ── Aging Bucket Cards ──────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-stagger">
        <AgingBucketCard
          label="Current"
          count={summary.buckets.current}
          total={bucketTotals.current}
          colorClass="text-emerald-500"
          isActive={bucketFilter === "CURRENT"}
          onClick={() => toggleBucketFilter("CURRENT")}
        />
        <AgingBucketCard
          label="30+ Days"
          count={summary.buckets.thirtyPlus}
          total={bucketTotals.thirtyPlus}
          colorClass="text-amber-500"
          isActive={bucketFilter === "30_PLUS"}
          onClick={() => toggleBucketFilter("30_PLUS")}
        />
        <AgingBucketCard
          label="60+ Days"
          count={summary.buckets.sixtyPlus}
          total={bucketTotals.sixtyPlus}
          colorClass="text-orange-500"
          isActive={bucketFilter === "60_PLUS"}
          onClick={() => toggleBucketFilter("60_PLUS")}
        />
        <AgingBucketCard
          label="90+ Days"
          count={summary.buckets.ninetyPlus}
          total={bucketTotals.ninetyPlus}
          colorClass="text-destructive"
          isActive={bucketFilter === "90_PLUS"}
          onClick={() => toggleBucketFilter("90_PLUS")}
        />
      </div>

      {/* ── Filters ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tenant, property, unit..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={propertyFilter}
          onChange={(e) => setPropertyFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All Properties</option>
          {propertyOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={bucketFilter}
          onChange={(e) => setBucketFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All Aging</option>
          <option value="CURRENT">Current</option>
          <option value="30_PLUS">30+ Days</option>
          <option value="60_PLUS">60+ Days</option>
          <option value="90_PLUS">90+ Days</option>
        </select>
        {(searchQuery || propertyFilter || bucketFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery("");
              setPropertyFilter("");
              setBucketFilter("");
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* ── Tenant Table ────────────────────────────────── */}
      <Card className="border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left">
                  <SortHeader
                    label="Tenant"
                    sortKey="name"
                    currentSort={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-4 py-3 text-left">
                  <span className="text-xs font-medium text-muted-foreground">
                    Property / Unit
                  </span>
                </th>
                <th className="px-4 py-3 text-right">
                  <SortHeader
                    label="Balance Owed"
                    sortKey="balance"
                    currentSort={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortHeader
                    label="Monthly Rent"
                    sortKey="monthlyRent"
                    currentSort={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-4 py-3 text-left">
                  <SortHeader
                    label="Last Payment"
                    sortKey="lastPaymentDate"
                    currentSort={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-4 py-3 text-left">
                  <SortHeader
                    label="Aging"
                    sortKey="monthsOverdue"
                    currentSort={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-4 py-3 text-right">
                  <span className="text-xs font-medium text-muted-foreground">
                    Actions
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-sm text-muted-foreground"
                  >
                    No tenants match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr
                    key={row.tenantId}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">{row.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.email}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm">{row.propertyName}</p>
                        <p className="text-xs text-muted-foreground">
                          Unit {row.unitNumber}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-sm text-destructive">
                        {formatCurrency(row.balance)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm">
                        {formatCurrency(row.monthlyRent)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm">
                        {row.lastPaymentDate
                          ? formatDate(new Date(row.lastPaymentDate))
                          : "Never"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <AgingBadge bucket={row.agingBucket} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <TenantActions row={row} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Footer ──────────────────────────────────────── */}
      <p className="text-xs text-muted-foreground text-center">
        Showing {filtered.length} of {data.tenants.length} delinquent tenant
        {data.tenants.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

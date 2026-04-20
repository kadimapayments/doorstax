"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonTable } from "@/components/ui/skeleton-loader";
import { formatCurrency } from "@/lib/utils";
import {
  DollarSign,
  AlertTriangle,
  Home,
  TrendingUp,
  FileText,
  Loader2,
  Download,
  FileSpreadsheet,
  FileBarChart,
  ChevronRight,
} from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

type ReportId =
  | "rent-roll"
  | "delinquency"
  | "vacancy"
  | "cash-flow"
  | "tenant-ledger"
  | "owner-statements";

interface ReportMeta {
  id: ReportId;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  apiPath?: string;
  externalPath?: string;
  csv?: boolean;
  usesDateRange?: boolean;
}

const REPORTS: ReportMeta[] = [
  {
    id: "rent-roll",
    title: "Rent Roll",
    description:
      "Every unit with tenant, lease dates, rent amount, and occupancy.",
    icon: Home,
    apiPath: "/api/reports/rent-roll",
    csv: true,
  },
  {
    id: "delinquency",
    title: "Delinquency",
    description:
      "Tenants with outstanding balances, days past due, amount owed.",
    icon: AlertTriangle,
    apiPath: "/api/reports/delinquency",
    csv: true,
  },
  {
    id: "vacancy",
    title: "Vacancy",
    description:
      "Empty units with days vacant, last tenant, and asking rent.",
    icon: FileText,
    apiPath: "/api/reports/vacancy",
    csv: true,
  },
  {
    id: "cash-flow",
    title: "Cash Flow",
    description:
      "Monthly income vs expenses rollup across the selected range.",
    icon: TrendingUp,
    apiPath: "/api/reports/cash-flow",
    csv: true,
    usesDateRange: true,
  },
  {
    id: "tenant-ledger",
    title: "Tenant Ledger",
    description: "Full transaction history for a selected tenant.",
    icon: DollarSign,
    externalPath: "/dashboard/tenants",
  },
  {
    id: "owner-statements",
    title: "Owner Statements",
    description:
      "Monthly payout statements grouped by owner — see the Payouts page.",
    icon: FileBarChart,
    externalPath: "/dashboard/payouts",
  },
];

interface Property {
  id: string;
  name: string;
}

export default function ReportsPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const [startDate, setStartDate] = useState(
    defaultStart.toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10));

  const [activeReport, setActiveReport] = useState<ReportMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    rows: any[];
    summary: Record<string, any> | null;
  } | null>(null);

  useEffect(() => {
    // Load the property dropdown
    fetch("/api/properties")
      .then((r) => (r.ok ? r.json() : []))
      .then((body) => {
        const list = Array.isArray(body)
          ? body
          : body?.properties || [];
        setProperties(
          list.map((p: any) => ({ id: p.id, name: p.name }))
        );
      })
      .catch(() => {});
  }, []);

  async function run(meta: ReportMeta) {
    if (!meta.apiPath) return;
    setActiveReport(meta);
    setLoading(true);
    setData(null);
    try {
      const params = new URLSearchParams();
      if (propertyId) params.set("propertyId", propertyId);
      if (meta.usesDateRange) {
        params.set("startDate", startDate);
        params.set("endDate", endDate);
      }
      const res = await fetch(`${meta.apiPath}?${params.toString()}`);
      if (res.ok) {
        const body = await res.json();
        setData({ rows: body.rows || [], summary: body.summary || null });
      } else {
        toast.error("Failed to generate report");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  function downloadCsv(meta: ReportMeta) {
    if (!meta.apiPath) return;
    const params = new URLSearchParams();
    params.set("format", "csv");
    if (propertyId) params.set("propertyId", propertyId);
    if (meta.usesDateRange) {
      params.set("startDate", startDate);
      params.set("endDate", endDate);
    }
    // Opens the CSV endpoint; browser handles the Content-Disposition header.
    window.open(`${meta.apiPath}?${params.toString()}`, "_blank");
  }

  return (
    <div className="space-y-6 page-enter">
      <PageHeader
        title="Reports"
        description="Standard reports for your portfolio. Generate on-screen or export to CSV."
      />

      {/* Global filters */}
      <Card className="border-border">
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[160px]">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">
              Property
            </label>
            <select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm"
            >
              <option value="">All properties</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">
              Date range (cash flow only)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm"
              />
              <span className="text-muted-foreground text-xs">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report cards */}
      <div className="grid gap-3 sm:grid-cols-2 animate-stagger">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          const isActive = activeReport?.id === r.id;
          return (
            <Card
              key={r.id}
              className={
                "border-border card-hover " +
                (isActive ? "border-primary/60 bg-primary/5" : "")
              }
            >
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{r.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                      {r.description}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  {r.externalPath ? (
                    <Link href={r.externalPath}>
                      <Button size="sm" variant="outline">
                        Open
                        <ChevronRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  ) : (
                    <>
                      {r.csv && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadCsv(r)}
                        >
                          <FileSpreadsheet className="mr-1 h-3.5 w-3.5" />
                          CSV
                        </Button>
                      )}
                      <Button size="sm" onClick={() => run(r)}>
                        <Download className="mr-1 h-3.5 w-3.5" />
                        Generate
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Active report output */}
      {activeReport && (
        <ReportOutput
          meta={activeReport}
          loading={loading}
          data={data}
          onDownloadCsv={() => downloadCsv(activeReport)}
        />
      )}
    </div>
  );
}

function ReportOutput({
  meta,
  loading,
  data,
  onDownloadCsv,
}: {
  meta: ReportMeta;
  loading: boolean;
  data: { rows: any[]; summary: Record<string, any> | null } | null;
  onDownloadCsv: () => void;
}) {
  const columns = useMemo(() => {
    if (!data || data.rows.length === 0) return [];
    return Object.keys(data.rows[0]);
  }, [data]);

  return (
    <Card className="border-border">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-semibold">{meta.title}</h2>
            <p className="text-xs text-muted-foreground">
              {data
                ? `${data.rows.length} row${data.rows.length === 1 ? "" : "s"}`
                : "Loading…"}
            </p>
          </div>
          {data && data.rows.length > 0 && (
            <Button size="sm" variant="outline" onClick={onDownloadCsv}>
              <FileSpreadsheet className="mr-1 h-3.5 w-3.5" />
              Download CSV
            </Button>
          )}
        </div>

        {/* Summary stats */}
        {data?.summary && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(data.summary).map(([k, v]) => (
              <div
                key={k}
                className="rounded-lg border bg-muted/20 p-3"
              >
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {humanize(k)}
                </p>
                <p className="text-base font-semibold mt-1">
                  {formatValue(k, v)}
                </p>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <SkeletonTable rows={8} />
        ) : data && data.rows.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-12 w-12" />}
            title="No data"
            description="Adjust filters and try again."
          />
        ) : data ? (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  {columns.map((c) => (
                    <th key={c} className="px-3 py-2 font-medium">
                      {humanize(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.slice(0, 500).map((row, i) => (
                  <tr
                    key={i}
                    className="border-b last:border-0 hover:bg-muted/20"
                  >
                    {columns.map((c) => (
                      <td
                        key={c}
                        className="px-3 py-2 whitespace-nowrap text-foreground"
                      >
                        {String(row[c] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {data.rows.length > 500 && (
              <p className="text-xs text-muted-foreground p-3 border-t">
                Showing first 500 rows. Download the CSV for the full set.
              </p>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function humanize(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .replace(/_/g, " ")
    .trim();
}

function formatValue(key: string, v: unknown) {
  if (typeof v === "number") {
    const moneyKey = /(rent|income|expense|owed|balance|loss|cash|amount|net|potential)/i.test(
      key
    );
    if (moneyKey) return formatCurrency(v);
    if (/rate|percent/i.test(key)) return `${v}%`;
    return String(v);
  }
  return String(v);
}

"use client";

import { useEffect, useState } from "react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import {
  TrendingUp,
  Building2,
  Users,
  DollarSign,
  Clock,
  Trophy,
  AlertTriangle,
} from "lucide-react";

// --------------- Types ---------------

interface Metrics {
  occupancyRate: number;
  avgRentPerSqft: number;
  timelinessScore: number;
  avgTenure: number;
  totalUnits: number;
  occupiedUnits: number;
}

interface UnitRow {
  unitId: string;
  unitNumber: string;
  propertyName: string;
  propertyId: string;
  rent: number;
  sqft: number | null;
  status: string;
  portfolioAvg: number;
  priceTag: "optimal" | "below" | "above";
}

interface BuildingRow {
  propertyId: string;
  propertyName: string;
  totalUnits: number;
  occupiedUnits: number;
  occupancyRate: number;
  avgRent: number;
  timeliness: number;
  revenue: number;
  score: number;
}

interface TenantRow {
  tenantId: string;
  name: string;
  unitNumber: string;
  propertyName: string;
  leaseStart: string | null;
  tenureMonths: number;
  paymentScore: number;
  latePayments: number;
  totalPayments: number;
  status: "stable" | "at-risk" | "good";
}

interface PerformanceData {
  metrics: Metrics;
  unitAnalysis: UnitRow[];
  buildingPerformance: BuildingRow[];
  tenantInsights: TenantRow[];
}

// --------------- Helpers ---------------

function PriceTagBadge({ tag }: { tag: "optimal" | "below" | "above" }) {
  if (tag === "optimal") {
    return (
      <Badge
        variant="outline"
        className="bg-emerald-500/15 text-emerald-500 border-emerald-500/20 font-medium"
      >
        Optimally Priced
      </Badge>
    );
  }
  if (tag === "below") {
    return (
      <Badge
        variant="outline"
        className="bg-destructive/15 text-destructive border-destructive/20 font-medium"
      >
        Below Market
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="bg-blue-500/15 text-blue-500 border-blue-500/20 font-medium"
    >
      Above Market
    </Badge>
  );
}

function TenantStatusBadge({
  status,
}: {
  status: "stable" | "at-risk" | "good";
}) {
  if (status === "stable") {
    return (
      <Badge
        variant="outline"
        className="bg-emerald-500/15 text-emerald-500 border-emerald-500/20 font-medium"
      >
        Stable
      </Badge>
    );
  }
  if (status === "at-risk") {
    return (
      <Badge
        variant="outline"
        className="bg-destructive/15 text-destructive border-destructive/20 font-medium"
      >
        At Risk
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="font-medium">
      Good
    </Badge>
  );
}

// --------------- Column Definitions ---------------

const unitColumns: Column<UnitRow>[] = [
  {
    key: "unitNumber",
    header: "Unit",
    cell: (row) => <span className="font-medium">{row.unitNumber}</span>,
  },
  {
    key: "propertyName",
    header: "Property",
    cell: (row) => row.propertyName,
  },
  {
    key: "rent",
    header: "Current Rent",
    cell: (row) => formatCurrency(row.rent),
  },
  {
    key: "portfolioAvg",
    header: "Portfolio Avg",
    cell: (row) => formatCurrency(row.portfolioAvg),
  },
  {
    key: "status",
    header: "Status",
    cell: (row) => <StatusBadge status={row.status} />,
  },
  {
    key: "priceTag",
    header: "Price Tag",
    cell: (row) => <PriceTagBadge tag={row.priceTag} />,
  },
];

const tenantColumns: Column<TenantRow>[] = [
  {
    key: "name",
    header: "Tenant",
    cell: (row) => <span className="font-medium">{row.name}</span>,
  },
  {
    key: "unitNumber",
    header: "Unit",
    cell: (row) => row.unitNumber,
  },
  {
    key: "propertyName",
    header: "Property",
    cell: (row) => row.propertyName,
  },
  {
    key: "tenureMonths",
    header: "Tenure",
    cell: (row) => `${row.tenureMonths} mo`,
  },
  {
    key: "paymentScore",
    header: "Payment Score",
    cell: (row) => `${row.paymentScore}%`,
  },
  {
    key: "latePayments",
    header: "Late Payments",
    cell: (row) => row.latePayments,
  },
  {
    key: "status",
    header: "Status",
    cell: (row) => <TenantStatusBadge status={row.status} />,
  },
];

// --------------- Page Component ---------------

export default function PerformancePage() {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/performance")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load performance data");
        return res.json();
      })
      .then((json: PerformanceData) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Performance Analytics"
          description="Portfolio performance overview and insights."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Performance Analytics"
          description="Portfolio performance overview and insights."
        />
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-muted-foreground">
              {error || "Unable to load performance data."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { metrics, unitAnalysis, buildingPerformance, tenantInsights } = data;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Performance Analytics"
        description="Portfolio performance overview and insights."
      />

      {/* ── Metric Cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
              <Building2 className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Portfolio Occupancy
              </p>
              <p className="text-2xl font-bold">{metrics.occupancyRate}%</p>
              <p className="text-xs text-muted-foreground">
                {metrics.occupiedUnits} / {metrics.totalUnits} units
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
              <DollarSign className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Rent / Sqft</p>
              <p className="text-2xl font-bold">
                ${metrics.avgRentPerSqft.toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Payment Timeliness
              </p>
              <p className="text-2xl font-bold">{metrics.timelinessScore}%</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
              <Users className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Avg Tenant Tenure
              </p>
              <p className="text-2xl font-bold">{metrics.avgTenure} months</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Unit Pricing Analysis ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Unit Pricing Analysis</h2>
        </div>
        <DataTable
          columns={unitColumns}
          data={unitAnalysis}
          emptyMessage="No units found."
        />
      </section>

      {/* ── Building Performance ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Building Performance</h2>
        </div>
        {buildingPerformance.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No properties found.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {buildingPerformance.map((bld, idx) => (
              <Card key={bld.propertyId} className="relative">
                {idx === 0 && (
                  <div className="absolute -top-2 -right-2">
                    <Badge className="bg-amber-500 text-white border-0 gap-1">
                      <Trophy className="h-3 w-3" />
                      Best Performing
                    </Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {bld.propertyName}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <div className="text-muted-foreground">Occupancy</div>
                    <div className="text-right font-medium">
                      {bld.occupancyRate}%
                      <span className="text-muted-foreground font-normal ml-1">
                        ({bld.occupiedUnits}/{bld.totalUnits})
                      </span>
                    </div>

                    <div className="text-muted-foreground">Avg Rent</div>
                    <div className="text-right font-medium">
                      {formatCurrency(bld.avgRent)}
                    </div>

                    <div className="text-muted-foreground">Timeliness</div>
                    <div className="text-right font-medium">
                      {bld.timeliness}%
                    </div>

                    <div className="text-muted-foreground">Total Revenue</div>
                    <div className="text-right font-medium">
                      {formatCurrency(bld.revenue)}
                    </div>

                    <div className="text-muted-foreground">Score</div>
                    <div className="text-right font-bold text-primary">
                      {bld.score}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── Tenant Insights ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Tenant Insights</h2>
        </div>
        <DataTable
          columns={tenantColumns}
          data={tenantInsights}
          emptyMessage="No tenants found."
        />
      </section>
    </div>
  );
}

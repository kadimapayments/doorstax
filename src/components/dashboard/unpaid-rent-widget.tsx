"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, cn } from "@/lib/utils";
import { AlertTriangle, ExternalLink } from "lucide-react";

/* ── Types (shared with dashboard) ─────────────────────────── */

interface UnpaidTenantRow {
  tenantId: string;
  name: string;
  propertyName: string;
  unitNumber: string;
  balance: number;
  agingBucket: string;
}

interface UnpaidSummary {
  totalUnpaid: number;
  delinquentCount: number;
  collectionRate: number;
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

/* ── Aging Badge (compact) ─────────────────────────────────── */

const agingStyles: Record<string, string> = {
  CURRENT: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
  "30_PLUS": "bg-amber-500/15 text-amber-500 border-amber-500/20",
  "60_PLUS": "bg-orange-500/15 text-orange-500 border-orange-500/20",
  "90_PLUS": "bg-destructive/15 text-destructive border-destructive/20",
};

const agingLabels: Record<string, string> = {
  CURRENT: "Current",
  "30_PLUS": "30+",
  "60_PLUS": "60+",
  "90_PLUS": "90+",
};

/* ── Bucket Mini Card ──────────────────────────────────────── */

function BucketMiniCard({
  label,
  count,
  colorClass,
  gradient,
}: {
  label: string;
  count: number;
  colorClass: string;
  gradient: string;
}) {
  if (count === 0) return null;
  return (
    <Card className="border-border card-glow animate-fade-in-up">
      <CardContent className="p-3 flex items-center gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white font-bold text-xs shadow-md",
            gradient
          )}
        >
          {count}
        </div>
        <div className="min-w-0">
          <p className={cn("text-xs font-semibold", colorClass)}>{label}</p>
          <p className="text-[10px] text-muted-foreground">
            {count} tenant{count !== 1 ? "s" : ""}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Main Widget ───────────────────────────────────────────── */

export function UnpaidRentWidget() {
  const [data, setData] = useState<UnpaidData | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return null;
  if (!data || data.tenants.length === 0) return null;

  const { summary, tenants } = data;
  const topTenants = tenants.slice(0, 5);
  const buckets = summary.buckets;

  return (
    <div>
      {/* ── Header ──────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <h2 className="text-lg font-semibold">Unpaid Rent</h2>
        <Badge variant="secondary" className="text-xs">
          {summary.delinquentCount} tenant
          {summary.delinquentCount !== 1 ? "s" : ""}
        </Badge>
        <span className="text-sm text-muted-foreground ml-1">
          {formatCurrency(summary.totalUnpaid)} outstanding
        </span>
        <Link
          href="/dashboard/unpaid"
          className="ml-auto text-xs text-primary hover:underline flex items-center gap-1"
        >
          View all
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {/* ── Aging Buckets ───────────────────────────── */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 mb-4 animate-stagger">
        <BucketMiniCard
          label="Current"
          count={buckets.current}
          colorClass="text-emerald-500"
          gradient="bg-gradient-to-br from-emerald-400 to-emerald-700"
        />
        <BucketMiniCard
          label="30+ Days"
          count={buckets.thirtyPlus}
          colorClass="text-amber-500"
          gradient="bg-gradient-to-br from-amber-400 to-amber-700"
        />
        <BucketMiniCard
          label="60+ Days"
          count={buckets.sixtyPlus}
          colorClass="text-orange-500"
          gradient="bg-gradient-to-br from-orange-400 to-orange-700"
        />
        <BucketMiniCard
          label="90+ Days"
          count={buckets.ninetyPlus}
          colorClass="text-destructive"
          gradient="bg-gradient-to-br from-red-400 to-red-700"
        />
      </div>

      {/* ── Top Delinquent Tenants ───────────────────── */}
      <div className="space-y-2 animate-stagger">
        {topTenants.map((tenant) => (
          <Card
            key={tenant.tenantId}
            className="border-border card-glow animate-fade-in-up transition-colors hover:border-border-hover"
          >
            <CardContent className="p-3 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{tenant.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {tenant.propertyName} — Unit {tenant.unitNumber}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge
                  variant="outline"
                  className={cn(
                    agingStyles[tenant.agingBucket] || "",
                    "font-medium text-[10px]"
                  )}
                >
                  {agingLabels[tenant.agingBucket] || tenant.agingBucket}
                </Badge>
                <span className="font-semibold text-sm text-destructive whitespace-nowrap">
                  {formatCurrency(tenant.balance)}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
        {tenants.length > 5 && (
          <Link
            href="/dashboard/unpaid"
            className="block text-center text-xs text-primary hover:underline py-1"
          >
            +{tenants.length - 5} more tenants with balances
          </Link>
        )}
      </div>
    </div>
  );
}

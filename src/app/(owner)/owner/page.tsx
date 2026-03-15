"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Building2,
  DollarSign,
  Home,
  TrendingUp,
  Users,
  Target,
  KeyRound,
  Download,
} from "lucide-react";
import { MonthlyAuthorizationDetail } from "@/components/dashboard/monthly-authorization-detail";
import { PortfolioChangesChart } from "@/components/dashboard/portfolio-changes-chart";

interface Payout {
  id: string;
  periodStart: string;
  periodEnd: string;
  grossRent: number;
  netPayout: number;
  status: string;
}

interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  units: number;
  occupied: number;
}

interface DashboardData {
  ownerName: string;
  properties: number;
  totalUnits: number;
  occupiedUnits: number;
  occupancyRate: number;
  totalMonthlyRent: number;
  avgRentPerUnit: number;
  collectionRate: number;
  vacantUnits: number;
  ytdGrossRent: number;
  ytdNetPayouts: number;
  recentPayouts: Payout[];
  propertyList: Property[];
}

export default function OwnerDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/owner/dashboard")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        Unable to load dashboard data.
      </div>
    );
  }

  const stats = [
    {
      label: "Properties",
      value: data.properties,
      icon: Building2,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950",
    },
    {
      label: "Total Units",
      value: data.totalUnits,
      icon: Home,
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-950",
    },
    {
      label: "Occupancy Rate",
      value: `${data.occupancyRate}%`,
      icon: Users,
      color: "text-violet-600",
      bg: "bg-violet-50 dark:bg-violet-950",
    },
    {
      label: "YTD Gross Rent",
      value: formatCurrency(data.ytdGrossRent),
      icon: DollarSign,
      color: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-950",
    },
    {
      label: "YTD Net Payouts",
      value: formatCurrency(data.ytdNetPayouts),
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-50 dark:bg-green-950",
    },
    {
      label: "Avg Rent / Unit",
      value: formatCurrency(data.avgRentPerUnit),
      icon: DollarSign,
      color: "text-cyan-600",
      bg: "bg-cyan-50 dark:bg-cyan-950",
    },
    {
      label: "Collection Rate",
      value: `${data.collectionRate}%`,
      icon: Target,
      color: "text-indigo-600",
      bg: "bg-indigo-50 dark:bg-indigo-950",
    },
    {
      label: "Vacant Units",
      value: data.vacantUnits,
      icon: KeyRound,
      color: data.vacantUnits > 0 ? "text-amber-600" : "text-green-600",
      bg: data.vacantUnits > 0 ? "bg-amber-50 dark:bg-amber-950" : "bg-green-50 dark:bg-green-950",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back, {data.ownerName}
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s an overview of your portfolio.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${s.bg}`}
              >
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="truncate text-lg font-semibold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Authorization Analytics */}
      <MonthlyAuthorizationDetail scope="owner" />

      {/* Portfolio Changes */}
      <PortfolioChangesChart scope="owner" />

      {/* Recent Payouts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Payouts</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentPayouts.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">
              No payouts yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Period</th>
                    <th className="pb-2 font-medium">Gross Rent</th>
                    <th className="pb-2 font-medium">Net Payout</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentPayouts.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-3">
                        {formatDate(p.periodStart)} &ndash;{" "}
                        {formatDate(p.periodEnd)}
                      </td>
                      <td className="py-3">{formatCurrency(p.grossRent)}</td>
                      <td className="py-3 font-medium">
                        {formatCurrency(p.netPayout)}
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            p.status === "PAID"
                              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                              : p.status === "DRAFT"
                              ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3">
                        {p.status === "PAID" && (
                          <button
                            onClick={() => {
                              const d = new Date(p.periodStart);
                              window.open(
                                `/api/owner/statements/download?payoutId=${p.id}`,
                                "_blank"
                              );
                            }}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <Download className="h-3 w-3" />
                            PDF
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Properties Grid */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Your Properties</h2>
        {data.propertyList.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No properties assigned to your account yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.propertyList.map((p) => {
              const pct =
                p.units > 0
                  ? Math.round((p.occupied / p.units) * 100)
                  : 0;
              return (
                <Card key={p.id}>
                  <CardContent className="p-5">
                    <h3 className="font-semibold">{p.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {p.address}, {p.city}, {p.state}
                    </p>
                    <div className="mt-4 flex items-center justify-between text-sm">
                      <span>
                        {p.occupied}/{p.units} units occupied
                      </span>
                      <span className="font-medium">{pct}%</span>
                    </div>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

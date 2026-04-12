"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Eye, Loader2, CheckCircle, Circle } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function ImpersonatePMPage() {
  const params = useParams();
  const userId = params.userId as string;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/impersonate?userId=${userId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        PM data not available
      </div>
    );
  }

  return (
    <div>
      {/* Admin banner */}
      <div className="sticky top-0 z-50 bg-amber-500 text-black px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4" />
          <span className="text-sm font-semibold">
            Viewing as {data.name || "PM"} &mdash; Read Only
          </span>
        </div>
        <Link
          href="/admin/merchants"
          className="text-sm underline font-medium"
        >
          Back to Merchants
        </Link>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-lg font-bold text-primary">
              {(data.name || "P")[0]}
            </span>
          </div>
          <div>
            <h1 className="text-xl font-bold">{data.name}</h1>
            <p className="text-sm text-muted-foreground">
              {data.email} &middot; {data.companyName || "No company"}
            </p>
          </div>
          <div className="ml-auto flex gap-2">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              {data.currentTier || "Starter"} Tier
            </Badge>
            {data.subscription?.status && (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                {data.subscription.status}
              </Badge>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-4">
          <Stat label="Properties" value={data.propertyCount} />
          <Stat label="Units" value={data.unitCount} />
          <Stat label="Tenants" value={data.tenantCount} />
          <Stat
            label="Monthly Revenue"
            value={formatCurrency(Number(data.monthlyRevenue || 0))}
          />
          <Stat label="Occupancy" value={`${data.occupancyRate ?? 0}%`} />
        </div>

        {/* Properties */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Properties</h2>
          {(data.properties || []).map((p: any) => (
            <Card key={p.id} className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.address}, {p.city}, {p.state} {p.zip}
                    </p>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {p.units?.length || 0} units
                  </span>
                </div>
                {p.units?.length > 0 && (
                  <div className="mt-3 border-t pt-3 grid grid-cols-2 gap-2">
                    {p.units.map((u: any) => (
                      <div
                        key={u.id}
                        className="text-sm flex items-center justify-between p-2 rounded bg-muted/30"
                      >
                        <span>{u.unitNumber || u.name || "Unit"}</span>
                        <span
                          className={
                            u.tenant
                              ? "text-green-600 text-xs"
                              : "text-gray-400 text-xs"
                          }
                        >
                          {u.tenant?.name || "Vacant"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Payments */}
        {data.recentPayments?.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Recent Payments</h2>
            <Card className="border-border">
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-4 py-2 text-left font-medium">Date</th>
                      <th className="px-4 py-2 text-left font-medium">
                        Tenant
                      </th>
                      <th className="px-4 py-2 text-right font-medium">
                        Amount
                      </th>
                      <th className="px-4 py-2 text-center font-medium">
                        Method
                      </th>
                      <th className="px-4 py-2 text-center font-medium">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentPayments.map((p: any) => (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="px-4 py-2 text-xs text-muted-foreground">
                          {formatDate(p.createdAt)}
                        </td>
                        <td className="px-4 py-2 text-xs">
                          {p.tenantName || "\u2014"}
                        </td>
                        <td className="px-4 py-2 text-right font-medium">
                          {formatCurrency(Number(p.amount))}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <Badge variant="outline" className="text-[10px]">
                            {p.paymentMethod || "\u2014"}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <Badge
                            variant="outline"
                            className={
                              p.status === "COMPLETED"
                                ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/20"
                                : "bg-amber-500/15 text-amber-500 border-amber-500/20"
                            }
                          >
                            {p.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Onboarding */}
        {data.onboarding && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Onboarding Status</h2>
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(data.onboarding).map(
                    ([key, val]: [string, any]) => (
                      <div key={key} className="flex items-center gap-2">
                        {val ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <Circle className="h-4 w-4 text-gray-300" />
                        )}
                        <span className="text-sm capitalize">
                          {key.replace(/([A-Z])/g, " $1").trim()}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="border-border">
      <CardContent className="p-3">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
          {label}
        </div>
        <div className="text-lg font-bold mt-0.5 truncate">{value}</div>
      </CardContent>
    </Card>
  );
}

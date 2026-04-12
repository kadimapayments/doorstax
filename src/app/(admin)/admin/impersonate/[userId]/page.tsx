"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Eye, Loader2, Check } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function ImpersonatePMPage() {
  const params = useParams();
  const userId = params.userId as string;
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/impersonate?userId=${userId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setD)
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!d) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        PM data not available
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Admin banner */}
      <div className="sticky top-0 z-50 bg-amber-500 px-4 py-2.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 text-amber-950">
          <Eye className="h-4 w-4" />
          <span className="text-sm font-semibold">
            Viewing as: {d.name} ({d.email})
          </span>
          <span className="text-xs bg-amber-600/20 px-2 py-0.5 rounded-full">
            Read Only
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/merchants"
            className="text-sm font-medium text-amber-950 hover:underline"
          >
            &larr; Back to PMs
          </Link>
        </div>
      </div>

      {/* PM dashboard mirror — pointer-events-none makes it truly read-only */}
      <div className="pointer-events-none select-none">
        <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
          {/* Welcome */}
          <div>
            <h1 className="text-2xl font-bold">
              {getGreeting()}, {d.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {d.companyName || "Property Manager"}
            </p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <StatCard label="Properties" value={d.propertyCount} />
            <StatCard label="Units" value={d.unitCount} />
            <StatCard label="Tenants" value={d.tenantCount} />
            <StatCard
              label="Monthly Revenue"
              value={formatCurrency(Number(d.monthlyRevenue || 0))}
              className="text-green-600"
            />
            <StatCard label="Occupancy" value={`${d.occupancyRate ?? 0}%`} />
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2/3 */}
            <div className="lg:col-span-2 space-y-6">
              {/* Recent Payments */}
              <div className="rounded-xl border bg-card p-5">
                <h2 className="text-base font-semibold mb-4">
                  Recent Payments
                </h2>
                {d.recentPayments?.length > 0 ? (
                  <div className="space-y-2">
                    {d.recentPayments.slice(0, 10).map((p: any) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between py-2 border-b last:border-0"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {p.tenantName || "Tenant"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(p.createdAt)} &middot;{" "}
                            {p.paymentMethod || "Payment"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">
                            {formatCurrency(Number(p.amount))}
                          </p>
                          <span
                            className={
                              "text-xs px-1.5 py-0.5 rounded-full " +
                              (p.status === "COMPLETED"
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-amber-100 text-amber-700")
                            }
                          >
                            {p.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No recent payments
                  </p>
                )}
              </div>

              {/* Properties */}
              <div className="rounded-xl border bg-card p-5">
                <h2 className="text-base font-semibold mb-4">Properties</h2>
                <div className="space-y-3">
                  {(d.properties || []).map((p: any) => (
                    <div key={p.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.address}, {p.city}, {p.state} {p.zip}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {p.units?.length || 0} units
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {p.units?.filter((u: any) => u.tenant).length || 0}{" "}
                            occupied
                          </p>
                        </div>
                      </div>
                      {p.units?.length > 0 && (
                        <div className="mt-2 pt-2 border-t grid grid-cols-2 gap-1.5">
                          {p.units.map((u: any) => (
                            <div
                              key={u.id}
                              className="text-xs flex items-center justify-between p-1.5 rounded bg-muted/30"
                            >
                              <span className="font-medium">
                                {u.unitNumber || "Unit"}
                              </span>
                              <span
                                className={
                                  u.tenant
                                    ? "text-green-600"
                                    : "text-muted-foreground"
                                }
                              >
                                {u.tenant?.name || "Vacant"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right 1/3 */}
            <div className="space-y-6">
              <div className="rounded-xl border bg-card p-5">
                <h3 className="text-sm font-semibold mb-3">
                  Tier &amp; Earnings
                </h3>
                <div className="text-center">
                  <span className="text-lg font-bold text-primary">
                    {d.currentTier || "Starter"}
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">
                    {d.unitCount} units
                  </p>
                </div>
              </div>

              <div className="rounded-xl border bg-card p-5">
                <h3 className="text-sm font-semibold mb-3">Subscription</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span
                      className={
                        "font-medium " +
                        (d.subscription?.status === "ACTIVE"
                          ? "text-green-600"
                          : "text-amber-600")
                      }
                    >
                      {d.subscription?.status || "N/A"}
                    </span>
                  </div>
                  {d.subscription?.trialEndsAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Trial Ends</span>
                      <span>{formatDate(d.subscription.trialEndsAt)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border bg-card p-5">
                <h3 className="text-sm font-semibold mb-3">
                  Merchant Application
                </h3>
                <span
                  className={
                    "text-xs px-2 py-1 rounded-full font-medium " +
                    (d.merchantApp?.status === "APPROVED"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : d.merchantApp?.status === "EXPIRED"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700")
                  }
                >
                  {d.merchantApp?.status || "Not Started"}
                </span>
              </div>

              {d.onboarding && (
                <div className="rounded-xl border bg-card p-5">
                  <h3 className="text-sm font-semibold mb-3">Onboarding</h3>
                  <div className="space-y-1.5">
                    {Object.entries(d.onboarding).map(
                      ([key, val]: [string, any]) => (
                        <div key={key} className="flex items-center gap-2 text-sm">
                          {val ? (
                            <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center">
                              <Check className="h-2.5 w-2.5 text-white" />
                            </div>
                          ) : (
                            <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
                          )}
                          <span className={val ? "" : "text-muted-foreground"}>
                            {key
                              .replace(/([A-Z])/g, " $1")
                              .replace(/^./, (s) => s.toUpperCase())
                              .trim()}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${className || ""}`}>{value}</p>
    </div>
  );
}

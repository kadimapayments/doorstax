"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarClock,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  AlertTriangle,
  Clock,
  CalendarDays,
} from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

interface ExpiringLease {
  id: string;
  tenantName: string;
  propertyName: string;
  unitNumber: string;
  endDate: string;
  rentAmount: number;
  daysRemaining: number;
}

interface Bucket {
  label: string;
  maxDays: number;
  icon: typeof AlertTriangle;
  gradient: string;
  badgeClass: string;
  buttonClass: string;
  leases: ExpiringLease[];
}

/* ── Count Badge ──────────────────────────────────────── */
function CountBadge({ count, gradient }: { count: number; gradient: string }) {
  return (
    <div
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white font-bold text-sm shadow-md",
        gradient
      )}
    >
      {count}
    </div>
  );
}

/* ── Single Lease Stack (like PropertyStack) ─────────── */
function LeaseStack({ bucket }: { bucket: Bucket }) {
  const [expanded, setExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const { leases, label, icon: Icon, gradient, badgeClass, buttonClass } = bucket;
  const totalRent = leases.reduce((sum, l) => sum + l.rentAmount, 0);
  const topLease = leases[0];

  return (
    <Card className="border-border card-glow overflow-hidden animate-fade-in-up">
      <CardContent className="p-5">
        {/* ── Stack Header ───────────────────────── */}
        <div className="flex items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-3 min-w-0">
            <CountBadge count={leases.length} gradient={gradient} />
            <div className="min-w-0">
              <h3 className="font-bold text-base truncate">{label}</h3>
              <p className="text-xs text-muted-foreground">
                {leases.length} lease{leases.length !== 1 ? "s" : ""} expiring
              </p>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-muted-foreground mb-4">
          <span>{formatCurrency(totalRent)}/mo at risk</span>
          <span>
            Soonest: {topLease.daysRemaining}d
          </span>
        </div>

        {/* ── Collapsed: Stacked Card Visual ──── */}
        {!expanded && (
          <>
            <div
              className="relative cursor-pointer group"
              style={{ height: 120 + (Math.min(leases.length, 5) - 1) * 8 }}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              onClick={() => setExpanded(true)}
              role="button"
              aria-label={`Expand ${label}`}
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setExpanded(true)}
            >
              {leases.slice(0, 5).map((lease, index) => {
                const depth = Math.min(leases.length, 5) - 1 - index;
                const isTop = depth === 0;

                const xOffset = depth * (isHovered ? 8 : 5);
                const yOffset = depth * (isHovered ? 12 : 8);
                const rotation = depth * (isHovered ? -1 : -0.6);
                const scale = 1 - depth * 0.025;
                const dimming = 1 - depth * 0.06;

                return (
                  <div
                    key={lease.id}
                    className="absolute inset-0 transition-all duration-300 ease-out"
                    style={{
                      transform: `translateX(${xOffset}px) translateY(${yOffset}px) rotate(${rotation}deg) scale(${scale})`,
                      zIndex: 5 - depth,
                    }}
                  >
                    <Card
                      className={cn(
                        "h-full border-border transition-colors",
                        isTop && "hover:border-border-hover"
                      )}
                      style={{
                        filter:
                          depth > 0 ? `brightness(${dimming})` : undefined,
                        boxShadow: `0 ${4 + depth * 3}px ${10 + depth * 6}px rgba(0,0,0,${0.06 + depth * 0.04})`,
                      }}
                    >
                      <CardContent className="p-4">
                        {isTop ? (
                          <>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <span className="font-semibold text-sm truncate">
                                {lease.tenantName}
                              </span>
                              <Badge className={cn("text-[10px] ml-auto shrink-0", badgeClass)}>
                                {lease.daysRemaining}d left
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground truncate">
                              {lease.propertyName} — {lease.unitNumber}
                            </p>
                            <div className="mt-3 flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">
                                Expires {formatDate(new Date(lease.endDate))}
                              </span>
                              <span className="font-medium">
                                {formatCurrency(lease.rentAmount)}/mo
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs font-medium truncate">
                              {lease.tenantName}
                            </span>
                            <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                              {lease.daysRemaining}d
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
              {leases.length > 5 && (
                <div className="absolute bottom-2 right-2 z-10 rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground shadow-md">
                  +{leases.length - 5} more
                </div>
              )}
            </div>

            {/* CTA */}
            <div className="mt-3 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpanded(true)}
                className={cn("font-semibold", buttonClass)}
              >
                View Stack
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          </>
        )}

        {/* ── Expanded: Lease List ─────────────── */}
        {expanded && (
          <>
            <div className="space-y-2 animate-unstack">
              {leases.map((lease) => (
                <Card
                  key={lease.id}
                  className="border-border transition-colors hover:border-border-hover"
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        href={`/dashboard/leases/${lease.id}`}
                        className="flex items-center gap-2 min-w-0 flex-1"
                      >
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {lease.tenantName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {lease.propertyName} — {lease.unitNumber}
                          </p>
                        </div>
                      </Link>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <p className="text-xs font-medium">
                            {formatCurrency(lease.rentAmount)}/mo
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(new Date(lease.endDate))}
                          </p>
                        </div>
                        <Badge className={cn("text-[10px]", badgeClass)}>
                          {lease.daysRemaining}d
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-3 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpanded(false)}
                className={cn("font-semibold", buttonClass)}
              >
                Collapse
                <ChevronUp className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Main Component ───────────────────────────────────── */
export function ExpiringLeases() {
  const [leases, setLeases] = useState<ExpiringLease[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leases/expiring")
      .then((r) => {
        if (r.ok) return r.json();
        return [];
      })
      .then((data) => setLeases(Array.isArray(data) ? data : []))
      .catch(() => setLeases([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (leases.length === 0) return null;

  // Auto-bucket by days remaining
  const under30 = leases.filter((l) => l.daysRemaining <= 30);
  const under60 = leases.filter(
    (l) => l.daysRemaining > 30 && l.daysRemaining <= 60
  );
  const under90 = leases.filter(
    (l) => l.daysRemaining > 60 && l.daysRemaining <= 90
  );

  const buckets: Bucket[] = [
    {
      label: "Under 30 Days",
      maxDays: 30,
      icon: AlertTriangle,
      gradient: "bg-gradient-to-br from-red-400 to-red-700",
      badgeClass: "bg-red-500/10 text-red-500 border-red-500/20",
      buttonClass:
        "border-red-400 text-red-700 hover:bg-red-50 dark:border-red-500 dark:text-red-300 dark:hover:bg-red-950",
      leases: under30,
    },
    {
      label: "Under 60 Days",
      maxDays: 60,
      icon: Clock,
      gradient: "bg-gradient-to-br from-amber-400 to-amber-700",
      badgeClass: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      buttonClass:
        "border-amber-400 text-amber-700 hover:bg-amber-50 dark:border-amber-500 dark:text-amber-300 dark:hover:bg-amber-950",
      leases: under60,
    },
    {
      label: "Under 90 Days",
      maxDays: 90,
      icon: CalendarDays,
      gradient: "bg-gradient-to-br from-purple-400 to-purple-700",
      badgeClass: "bg-purple-500/10 text-purple-500 border-purple-500/20",
      buttonClass:
        "border-purple-400 text-purple-700 hover:bg-purple-50 dark:border-purple-500 dark:text-purple-300 dark:hover:bg-purple-950",
      leases: under90,
    },
  ].filter((b) => b.leases.length > 0);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <CalendarClock className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Expiring Leases</h2>
        <Badge variant="secondary" className="text-xs">
          {leases.length} total
        </Badge>
        <Link
          href="/dashboard/leases?status=ACTIVE"
          className="ml-auto text-xs text-primary hover:underline flex items-center gap-1"
        >
          View all
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-stagger">
        {buckets.map((bucket) => (
          <LeaseStack key={bucket.maxDays} bucket={bucket} />
        ))}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Building2, ChevronRight, ChevronUp, Users, CreditCard } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { TenantRow } from "./tenant-table";

interface TenantBuildingStackProps {
  propertyName: string;
  tenants: TenantRow[];
}

function CountBadge({ count }: { count: number }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-purple-700 text-white font-bold text-sm shadow-md">
      {count}
    </div>
  );
}

export function TenantBuildingStack({ propertyName, tenants }: TenantBuildingStackProps) {
  const [expanded, setExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const totalRent = tenants.reduce((sum, t) => sum + t.rent * t.split / 100, 0);
  const activeCount = tenants.filter((t) => t.status === "ACTIVE").length;
  const autopayCount = tenants.filter((t) => t.autopay).length;
  const autopayRate = tenants.length > 0 ? Math.round((autopayCount / tenants.length) * 100) : 0;
  const uniqueUnits = new Set(tenants.map((t) => t.unit)).size;

  return (
    <Card className="border-border card-glow overflow-hidden animate-fade-in-up">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-3 min-w-0">
            <CountBadge count={tenants.length} />
            <div className="min-w-0">
              <h3 className="font-bold text-base truncate">{propertyName}</h3>
              <p className="text-xs text-muted-foreground">
                {tenants.length} tenant{tenants.length !== 1 ? "s" : ""} &middot; {uniqueUnits} unit{uniqueUnits !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-muted-foreground mb-4">
          <span>{activeCount} active</span>
          <span>{autopayRate}% autopay</span>
          <span className="text-green-600 dark:text-green-400 font-medium">{formatCurrency(totalRent)}/mo</span>
        </div>

        {/* Collapsed: Stacked Card Visual */}
        {!expanded && (
          <>
            <div
              className="relative cursor-pointer group"
              style={{ height: 100 + (Math.min(tenants.length, 4) - 1) * 6 }}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              onClick={() => setExpanded(true)}
              role="button"
              aria-label={`Expand ${propertyName} tenants`}
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setExpanded(true)}
            >
              {tenants.slice(0, 4).map((tenant, index) => {
                const depth = Math.min(tenants.length, 4) - 1 - index;
                const isTop = depth === 0;

                const xOffset = depth * (isHovered ? 6 : 4);
                const yOffset = depth * (isHovered ? 10 : 6);
                const rotation = depth * (isHovered ? -0.8 : -0.5);
                const scale = 1 - depth * 0.02;
                const dimming = 1 - depth * 0.06;

                return (
                  <div
                    key={tenant.id}
                    className="absolute inset-0 transition-all duration-300 ease-out"
                    style={{
                      transform: `translateX(${xOffset}px) translateY(${yOffset}px) rotate(${rotation}deg) scale(${scale})`,
                      zIndex: 4 - depth,
                    }}
                  >
                    <Card
                      className={cn(
                        "h-full border-border transition-colors",
                        isTop && "hover:border-border-hover"
                      )}
                      style={{
                        filter: depth > 0 ? `brightness(${dimming})` : undefined,
                        boxShadow: `0 ${3 + depth * 2}px ${8 + depth * 4}px rgba(0,0,0,${0.05 + depth * 0.03})`,
                      }}
                    >
                      <CardContent className="p-3">
                        {isTop ? (
                          <>
                            <div className="flex items-center gap-2">
                              <Users className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-medium text-sm truncate">{tenant.name}</span>
                              {!tenant.isPrimary && (
                                <span className="text-[10px] text-muted-foreground">(Roommate)</span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground truncate">
                              Unit {tenant.unit} &middot; {formatCurrency(tenant.rent * tenant.split / 100)}/mo
                            </p>
                            <div className="mt-2 flex items-center gap-2">
                              <StatusBadge status={tenant.status} />
                              <StatusBadge status={tenant.autopay ? "ACTIVE" : "PAUSED"} />
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Users className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs font-medium truncate">{tenant.name}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
              {tenants.length > 4 && (
                <div className="absolute bottom-1 right-1 z-10 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow-md">
                  +{tenants.length - 4} more
                </div>
              )}
            </div>

            <div className="mt-3 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpanded(true)}
                className="border-purple-400 text-purple-700 hover:bg-purple-50 dark:border-purple-500 dark:text-purple-300 dark:hover:bg-purple-950 font-semibold"
              >
                View Tenants
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          </>
        )}

        {/* Expanded: Tenant List */}
        {expanded && (
          <>
            <div className="space-y-2 animate-unstack">
              {tenants.map((tenant) => (
                <div
                  key={tenant.id}
                  className="rounded-lg border border-border p-3 flex items-center justify-between gap-2 hover:border-border-hover transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {tenant.name}
                      {!tenant.isPrimary && (
                        <span className="ml-1.5 text-xs text-muted-foreground">(Roommate)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      Unit {tenant.unit} &middot; {tenant.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-medium">
                      {formatCurrency(tenant.rent * tenant.split / 100)}
                    </span>
                    <StatusBadge status={tenant.status} />
                    <StatusBadge status={tenant.autopay ? "ACTIVE" : "PAUSED"} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpanded(false)}
                className="border-purple-400 text-purple-700 hover:bg-purple-50 dark:border-purple-500 dark:text-purple-300 dark:hover:bg-purple-950 font-semibold"
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

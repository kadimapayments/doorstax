"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Search, List, LayoutGrid, ChevronUp, ChevronDown } from "lucide-react";

interface UnitData {
  id: string;
  unitNumber: string;
  rentAmount: number | string;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  status: string;
  tenantProfiles: Array<{
    user: { name: string | null; email: string | null } | null;
  }>;
}

interface PropertyUnitsSectionProps {
  propertyId: string;
  units: UnitData[];
}

export function PropertyUnitsSection({ propertyId, units }: PropertyUnitsSectionProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [unitSearch, setUnitSearch] = useState("");
  const [showAllUnits, setShowAllUnits] = useState(false);
  const [occupancyFilter, setOccupancyFilter] = useState<"all" | "available" | "occupied">("all");
  const [bedsFilter, setBedsFilter] = useState("all");
  const [bathsFilter, setBathsFilter] = useState("all");

  const hasActiveFilters = unitSearch || occupancyFilter !== "all" || bedsFilter !== "all" || bathsFilter !== "all";

  const filteredUnits = units.filter((unit) => {
    // Search
    if (unitSearch) {
      const q = unitSearch.toLowerCase();
      const matchesNumber = unit.unitNumber?.toLowerCase().includes(q);
      const matchesTenant =
        unit.tenantProfiles?.[0]?.user?.name?.toLowerCase().includes(q) ||
        unit.tenantProfiles?.[0]?.user?.email?.toLowerCase().includes(q);
      if (!matchesNumber && !matchesTenant) return false;
    }
    // Occupancy
    if (occupancyFilter === "available") {
      if (unit.tenantProfiles?.length > 0 || unit.status === "OCCUPIED") return false;
    }
    if (occupancyFilter === "occupied") {
      if (!unit.tenantProfiles?.length && unit.status !== "OCCUPIED") return false;
    }
    // Bedrooms
    if (bedsFilter !== "all") {
      if (bedsFilter === "0" && unit.bedrooms !== 0) return false;
      else if (bedsFilter === "4+" && (unit.bedrooms ?? 0) < 4) return false;
      else if (bedsFilter !== "0" && bedsFilter !== "4+" && unit.bedrooms !== Number(bedsFilter)) return false;
    }
    // Bathrooms
    if (bathsFilter !== "all") {
      if (bathsFilter === "3+" && (unit.bathrooms ?? 0) < 3) return false;
      else if (bathsFilter !== "3+" && unit.bathrooms !== Number(bathsFilter)) return false;
    }
    return true;
  });

  const INITIAL_UNIT_COUNT = 10;
  const displayedUnits = (showAllUnits || unitSearch) ? filteredUnits : filteredUnits.slice(0, INITIAL_UNIT_COUNT);
  const hasMoreUnits = filteredUnits.length > INITIAL_UNIT_COUNT;

  useEffect(() => { setShowAllUnits(false); }, [unitSearch]);

  return (
    <div className="space-y-4">
      {/* Search + Filters + View Toggle */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search units or tenants..."
            value={unitSearch}
            onChange={(e) => setUnitSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Occupancy filter */}
        <div className="flex rounded-lg border overflow-hidden">
          {(["all", "available", "occupied"] as const).map((value) => (
            <button
              key={value}
              onClick={() => setOccupancyFilter(value)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors",
                occupancyFilter === value
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              )}
            >
              {value === "all" ? "All" : value === "available" ? "Available" : "Occupied"}
            </button>
          ))}
        </div>

        {/* Beds filter */}
        <select
          value={bedsFilter}
          onChange={(e) => setBedsFilter(e.target.value)}
          className="h-8 rounded-lg border bg-background px-2 text-xs"
        >
          <option value="all">All Beds</option>
          <option value="0">Studio</option>
          <option value="1">1 Bed</option>
          <option value="2">2 Beds</option>
          <option value="3">3 Beds</option>
          <option value="4+">4+ Beds</option>
        </select>

        {/* Baths filter */}
        <select
          value={bathsFilter}
          onChange={(e) => setBathsFilter(e.target.value)}
          className="h-8 rounded-lg border bg-background px-2 text-xs"
        >
          <option value="all">All Baths</option>
          <option value="1">1 Bath</option>
          <option value="1.5">1.5 Baths</option>
          <option value="2">2 Baths</option>
          <option value="2.5">2.5 Baths</option>
          <option value="3+">3+ Baths</option>
        </select>

        {/* View toggle */}
        <div className="flex items-center gap-1 border rounded-lg p-0.5 ml-auto">
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "p-1.5 rounded",
              viewMode === "list"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={cn(
              "p-1.5 rounded",
              viewMode === "grid"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Count + clear */}
      <p className="text-xs text-muted-foreground">
        Showing {filteredUnits.length} of {units.length} unit{units.length !== 1 ? "s" : ""}
        {hasActiveFilters && (
          <button
            onClick={() => { setUnitSearch(""); setOccupancyFilter("all"); setBedsFilter("all"); setBathsFilter("all"); }}
            className="ml-2 text-primary hover:underline"
          >
            Clear filters
          </button>
        )}
      </p>

      {/* List View */}
      {viewMode === "list" ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2 font-medium">Unit</th>
                <th className="px-4 py-2 font-medium">Rent</th>
                <th className="px-4 py-2 font-medium">Beds / Baths</th>
                <th className="px-4 py-2 font-medium">Sqft</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Tenant</th>
              </tr>
            </thead>
            <tbody>
              {displayedUnits.map((unit) => {
                const tenant = unit.tenantProfiles?.[0]?.user;
                const occupied = unit.tenantProfiles?.length > 0;
                return (
                  <tr
                    key={unit.id}
                    className="border-b hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() =>
                      router.push(
                        `/dashboard/properties/${propertyId}/units/${unit.id}`
                      )
                    }
                  >
                    <td className="px-4 py-2.5 font-medium">
                      {unit.unitNumber}
                    </td>
                    <td className="px-4 py-2.5">
                      {formatCurrency(Number(unit.rentAmount))}
                    </td>
                    <td className="px-4 py-2.5">
                      {unit.bedrooms ?? "—"} / {unit.bathrooms ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">{unit.sqft || "—"}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge
                        status={occupied ? "OCCUPIED" : "AVAILABLE"}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {tenant?.name || "—"}
                    </td>
                  </tr>
                );
              })}
              {filteredUnits.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No units found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {hasMoreUnits && !unitSearch && (
            <div className="flex justify-center py-3 border-t">
              <button
                onClick={() => setShowAllUnits(!showAllUnits)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {showAllUnits ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Show all {filteredUnits.length} units ({filteredUnits.length - INITIAL_UNIT_COUNT} more)
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Grid View */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayedUnits.map((unit) => {
            const tenant = unit.tenantProfiles?.[0]?.user;
            return (
              <Link
                key={unit.id}
                href={`/dashboard/properties/${propertyId}/units/${unit.id}`}
              >
                <Card className="border-border transition-colors hover:border-border-hover">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Unit {unit.unitNumber}</h3>
                      <StatusBadge status={unit.status} />
                    </div>
                    <p className="mt-2 text-lg font-bold">
                      {formatCurrency(Number(unit.rentAmount))}
                      <span className="text-sm font-normal text-muted-foreground">
                        /mo
                      </span>
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                      {unit.bedrooms !== null && (
                        <span>{unit.bedrooms} bed</span>
                      )}
                      {unit.bathrooms !== null && (
                        <span>&middot; {unit.bathrooms} bath</span>
                      )}
                      {unit.sqft !== null && (
                        <span>&middot; {unit.sqft} sqft</span>
                      )}
                    </div>
                    {tenant ? (
                      <p className="mt-3 text-sm">
                        <span className="text-muted-foreground">Tenant:</span>{" "}
                        {tenant.name}
                      </p>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">
                        No tenant assigned
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
          {hasMoreUnits && !unitSearch && (
            <div className="flex justify-center py-3">
              <button
                onClick={() => setShowAllUnits(!showAllUnits)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {showAllUnits ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Show all {filteredUnits.length} units ({filteredUnits.length - INITIAL_UNIT_COUNT} more)
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

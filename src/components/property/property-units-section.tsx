"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Search, List, LayoutGrid } from "lucide-react";

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

  const filteredUnits = units.filter((unit) => {
    if (!unitSearch) return true;
    const q = unitSearch.toLowerCase();
    return (
      unit.unitNumber?.toLowerCase().includes(q) ||
      unit.tenantProfiles?.[0]?.user?.name?.toLowerCase().includes(q) ||
      unit.tenantProfiles?.[0]?.user?.email?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Search + View Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search units or tenants..."
              value={unitSearch}
              onChange={(e) => setUnitSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {filteredUnits.length} unit{filteredUnits.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-1 border rounded-lg p-0.5">
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
              {filteredUnits.map((unit) => {
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
        </div>
      ) : (
        /* Grid View */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredUnits.map((unit) => {
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
        </div>
      )}
    </div>
  );
}

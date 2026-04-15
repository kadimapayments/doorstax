"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import {
  Search,
  MapPin,
  Home,
  Building2,
  Landmark,
  Store,
  Layers,
  LayoutGrid,
  List,
  Trophy,
  Plus,
} from "lucide-react";
import { PropertyStack } from "./property-stack";
import { UnderstandLevelsDialog } from "./understand-levels-dialog";
import { showPrompt } from "@/components/admin/dialog-prompt";
import { cn } from "@/lib/utils";
import { getLevel } from "@/lib/levels";

export interface PropertyData {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  propertyType: string;
  units: { id: string; unitNumber: string; status: string; rentAmount: number }[];
}

export const propertyTypeConfig: Record<string, { label: string; icon: typeof Home }> = {
  SINGLE_FAMILY: { label: "Single Family", icon: Home },
  MULTIFAMILY: { label: "Multifamily", icon: Building2 },
  OFFICE: { label: "Office", icon: Landmark },
  COMMERCIAL: { label: "Commercial", icon: Store },
};

const PROPERTY_TYPES = [
  { value: "", label: "All Types" },
  { value: "SINGLE_FAMILY", label: "Single Family" },
  { value: "MULTIFAMILY", label: "Multifamily" },
  { value: "OFFICE", label: "Office" },
  { value: "COMMERCIAL", label: "Commercial" },
];

/* ── Custom Stack Type ───────────────────────────────────── */
interface CustomStack {
  id: string;
  name: string;
  sortOrder: number;
  properties: PropertyData[];
}

/* ── Portfolio Header ────────────────────────────────────── */
function PortfolioHeader({
  buildings,
  doors,
  occupied,
  rent,
  stacks,
}: {
  buildings: number;
  doors: number;
  occupied: number;
  rent: number;
  stacks: number;
}) {
  const level = getLevel(doors);

  return (
    <div className="rounded-xl border border-border bg-card p-5 card-glow animate-fade-in-up">
      {/* Tagline */}
      <p className="gradient-text text-xs font-bold tracking-[0.2em] uppercase mb-3">
        Stack Doors, Get Paid!
      </p>

      {/* Stats row */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm mb-4">
        <span className="flex items-center gap-1.5">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">{buildings}</span>
          <span className="text-muted-foreground">Building{buildings !== 1 ? "s" : ""}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Home className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">{doors.toLocaleString()}</span>
          <span className="text-muted-foreground">Door{doors !== 1 ? "s" : ""}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="font-semibold text-green-600 dark:text-green-400">
            ${rent.toLocaleString()}
          </span>
          <span className="text-muted-foreground">/mo</span>
        </span>
      </div>

      {/* Stacks + Level row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {stacks} Stack{stacks !== 1 ? "s" : ""}
        </p>

        {/* Level badge + progress */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Trophy className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-bold">
              Lv.{level.index} {level.title}
            </span>
            <span className="text-sm">{level.emoji}</span>
          </div>
          {level.nextLevel && (
            <div className="flex items-center gap-1.5">
              <div className="w-20 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${level.pct}%`,
                    background: "linear-gradient(90deg, #BDA2FF, #5B00FF)",
                  }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">{level.pct}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Next level hint */}
      {level.nextLevel && (
        <p className="text-[11px] text-muted-foreground mt-2">
          {level.nextLevel.min - doors} more door{level.nextLevel.min - doors !== 1 ? "s" : ""} to reach{" "}
          <span className="font-semibold">{level.nextLevel.title}</span> {level.nextLevel.emoji}
        </p>
      )}

      {/* Understand Levels link */}
      <div className="mt-3 pt-3 border-t border-border">
        <UnderstandLevelsDialog doors={doors} />
      </div>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────── */
export function PropertySearch({ properties }: { properties: PropertyData[] }) {
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [viewMode, setViewMode] = useState<"stack" | "grid" | "list">("stack");

  // Custom stacks from DB
  const [customStacks, setCustomStacks] = useState<CustomStack[] | null>(null);
  const [stacksLoading, setStacksLoading] = useState(true);

  // Fetch custom stacks
  const fetchStacks = useCallback(() => {
    fetch("/api/property-stacks")
      .then((r) => r.json())
      .then((data) => setCustomStacks(data.stacks ?? []))
      .catch(() => setCustomStacks([]))
      .finally(() => setStacksLoading(false));
  }, []);

  useEffect(() => {
    fetchStacks();
  }, [fetchStacks]);

  // Auto-switch to grid when filters are active
  const hasActiveFilters = !!(search || cityFilter || stateFilter || typeFilter);
  const effectiveView = viewMode === "list" ? "list" : (hasActiveFilters ? "grid" : viewMode);

  // Derive unique cities and states from the data
  const cities = useMemo(() => {
    const set = new Set(properties.map((p) => p.city).filter(Boolean));
    return Array.from(set).sort();
  }, [properties]);

  const states = useMemo(() => {
    const set = new Set(properties.map((p) => p.state).filter(Boolean));
    return Array.from(set).sort();
  }, [properties]);

  const filtered = properties.filter((p) => {
    if (cityFilter && p.city !== cityFilter) return false;
    if (stateFilter && p.state !== stateFilter) return false;
    if (typeFilter && p.propertyType !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.state.toLowerCase().includes(q) ||
        p.zip.includes(q)
      );
    }
    return true;
  });

  // Compute stacks: use custom stacks if they exist, otherwise auto-chunk
  const stacks = useMemo(() => {
    if (customStacks && customStacks.length > 0) {
      // Map custom stacks, only including properties that are in the filtered set
      const filteredIds = new Set(filtered.map((p) => p.id));
      const assignedIds = new Set(customStacks.flatMap((s) => s.properties.map((p) => p.id)));

      const result: { id?: string; name: string; properties: PropertyData[] }[] = customStacks.map((s) => ({
        id: s.id,
        name: s.name || `Stack ${s.sortOrder + 1}`,
        properties: s.properties.filter((p) => filteredIds.has(p.id)),
      }));

      // Unassigned properties in a single group
      const unassigned = filtered.filter((p) => !assignedIds.has(p.id));
      if (unassigned.length > 0) {
        result.push({
          name: "Unassigned Properties",
          properties: unassigned,
        });
      }

      // Filter out empty stacks (all properties were filtered out), but keep custom stacks even if empty
      return result.filter((s) => s.id || s.properties.length > 0);
    }

    // Fallback: show all in a single group
    if (filtered.length === 0) return [];
    return [{ name: "All Properties", properties: filtered }];
  }, [filtered, customStacks]);

  // All stacks list for "Move to" dropdown (includes Unassigned option)
  const allStacksList = useMemo(
    () => [
      ...stacks
        .filter((s) => s.id)
        .map((s) => ({ id: s.id!, name: s.name })),
      { id: "__unassigned__", name: "Unassigned" },
    ],
    [stacks]
  );

  // Portfolio-level aggregates
  const totalBuildings = filtered.length;
  const totalDoors = filtered.reduce((sum, p) => sum + p.units.length, 0);
  const totalOccupied = filtered.reduce(
    (sum, p) => sum + p.units.filter((u) => u.status === "OCCUPIED").length,
    0
  );
  const totalRent = filtered.reduce(
    (sum, p) => sum + p.units.reduce((s, u) => s + u.rentAmount, 0),
    0
  );

  // ── Stack actions ──────────────────────────────
  async function handleCreateStack() {
    const name = await showPrompt({
      title: "Create Property Stack",
      description: "Group related properties together for easier filtering and reporting.",
      label: "Stack name",
      placeholder: "e.g. Downtown, Top Performers",
      submitLabel: "Create Stack",
    });
    if (name === null) return;
    await fetch("/api/property-stacks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() || "" }),
    });
    fetchStacks();
  }

  async function handleRenameStack(stackId: string, newName: string) {
    await fetch("/api/property-stacks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stackId, name: newName }),
    });
    fetchStacks();
  }

  async function handleMoveProperty(propertyId: string, targetStackId: string) {
    const actualTarget = targetStackId === "__unassigned__" ? null : targetStackId;
    await fetch("/api/property-stacks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "move", propertyId, targetStackId: actualTarget }),
    });
    fetchStacks();
  }

  async function handleDeleteStack(stackId: string) {
    await fetch(`/api/property-stacks?stackId=${stackId}`, { method: "DELETE" });
    fetchStacks();
  }

  async function handleReorderStack(stackId: string, direction: "up" | "down") {
    await fetch("/api/property-stacks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reorder", stackId, direction }),
    });
    fetchStacks();
  }

  return (
    <div className="space-y-4">
      {/* Filter bar with view toggle */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search properties..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {cities.length > 1 && (
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">All Cities</option>
              {cities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
          {states.length > 1 && (
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">All States</option>
              {states.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            {PROPERTY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "rounded p-1.5 transition-colors",
              effectiveView === "list"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="List view"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("stack")}
            className={cn(
              "rounded p-1.5 transition-colors",
              effectiveView === "stack"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Stack view"
          >
            <Layers className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={cn(
              "rounded p-1.5 transition-colors",
              effectiveView === "grid"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground">
        {filtered.length} propert{filtered.length !== 1 ? "ies" : "y"}
        {cityFilter && <> in {cityFilter}</>}
        {stateFilter && <>, {stateFilter}</>}
        {typeFilter && <> ({PROPERTY_TYPES.find((t) => t.value === typeFilter)?.label})</>}
      </p>

      {/* Conditional view rendering */}
      {effectiveView === "list" ? (
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Property</th>
                <th className="px-4 py-2.5 font-medium">Address</th>
                <th className="px-4 py-2.5 font-medium">Units</th>
                <th className="px-4 py-2.5 font-medium">Occupied</th>
                <th className="px-4 py-2.5 font-medium">Rent/mo</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const totalUnits = p.units.length;
                const occupiedUnits = p.units.filter((u) => u.status === "OCCUPIED").length;
                const propTotalRent = p.units.reduce((sum, u) => sum + u.rentAmount, 0);
                const occupancyPct = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
                return (
                  <tr
                    key={p.id}
                    className="border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => (window.location.href = `/dashboard/properties/${p.id}`)}
                  >
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.address}, {p.city}, {p.state} {p.zip}
                    </td>
                    <td className="px-4 py-3">{totalUnits}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          occupancyPct === 100
                            ? "text-emerald-500"
                            : occupancyPct >= 80
                            ? "text-foreground"
                            : "text-amber-500"
                        }
                      >
                        {occupiedUnits}/{totalUnits} ({occupancyPct}%)
                      </span>
                    </td>
                    <td className="px-4 py-3">${propTotalRent.toLocaleString()}/mo</td>
                    <td className="px-4 py-3">
                      {occupancyPct === 100 ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-500">
                          Full
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-500">
                          Available
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No properties found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : effectiveView === "stack" ? (
        <div className="space-y-6">
          {/* Portfolio gamification header */}
          <PortfolioHeader
            buildings={totalBuildings}
            doors={totalDoors}
            occupied={totalOccupied}
            rent={totalRent}
            stacks={stacks.length}
          />

          {/* Multi-stack grid */}
          {!stacksLoading && (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {stacks.map((stack, i) => (
                <PropertyStack
                  key={stack.id || `auto-${i}`}
                  properties={stack.properties}
                  stackIndex={i}
                  stackTotal={stacks.length}
                  stackId={stack.id}
                  stackName={stack.name}
                  allStacks={allStacksList}
                  onMoveProperty={handleMoveProperty}
                  onRenameStack={handleRenameStack}
                  onDeleteStack={handleDeleteStack}
                  onReorderStack={handleReorderStack}
                />
              ))}

              {/* Create Stack button */}
              <button
                onClick={handleCreateStack}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-8 text-muted-foreground hover:border-primary hover:text-primary transition-colors cursor-pointer min-h-[200px]"
              >
                <Plus className="h-8 w-8" />
                <span className="text-sm font-medium">Create Stack</span>
                <span className="text-xs">Group buildings your way</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-unstack" key="grid">
          {filtered.map((property) => {
            const occupied = property.units.filter((u) => u.status === "OCCUPIED").length;
            const total = property.units.length;
            const totalRent = property.units.reduce((sum, u) => sum + u.rentAmount, 0);
            const typeInfo = propertyTypeConfig[property.propertyType] || propertyTypeConfig.MULTIFAMILY;
            const TypeIcon = typeInfo.icon;

            return (
              <Link key={property.id} href={`/dashboard/properties/${property.id}`}>
                <Card className="border-border card-glow transition-colors hover:border-border-hover">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2">
                      <TypeIcon className="h-4 w-4 text-muted-foreground" />
                      <h3 className="font-semibold">{property.name}</h3>
                    </div>
                    <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {property.address}, {property.city}, {property.state} {property.zip}
                    </p>
                    <span className="text-xs text-muted-foreground">{typeInfo.label}</span>
                    <div className="mt-4 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {total} unit{total !== 1 ? "s" : ""}
                      </span>
                      <StatusBadge
                        status={total === 0 ? "EMPTY" : occupied === total ? "OCCUPIED" : "AVAILABLE"}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {occupied}/{total} occupied &middot; ${totalRent.toLocaleString()}/mo total rent
                    </p>
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

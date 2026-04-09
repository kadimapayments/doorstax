"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn, formatCurrency } from "@/lib/utils";
import { Search, Layers, LayoutGrid, Globe } from "lucide-react";
import { ListingBuildingStack } from "@/components/listings/listing-building-stack";
import { toast } from "sonner";

export interface ListingRow {
  id: string;
  propertyName: string;
  unitNumber: string;
  rent: number;
  status: string;
  listingEnabled: boolean;
  applicationsEnabled: boolean;
  propertyId: string;
  city?: string;
  propertyType?: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
}

type OccupancyFilter = "ALL" | "AVAILABLE" | "OCCUPIED";
type ListedFilter = "ALL" | "LISTED" | "NOT_LISTED";

const PROPERTY_TYPES = [
  { value: "", label: "All Types" },
  { value: "SINGLE_FAMILY", label: "Single Family" },
  { value: "MULTIFAMILY", label: "Multifamily" },
  { value: "OFFICE", label: "Office" },
  { value: "COMMERCIAL", label: "Commercial" },
];

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-accent-lavender text-white"
          : "bg-muted text-muted-foreground hover:bg-muted/80"
      )}
    >
      {label}
    </button>
  );
}

interface ListingTableProps {
  rows: ListingRow[];
  page: number;
  totalPages: number;
  totalCount: number;
  cities: string[];
  currentCity: string;
  currentPropertyType: string;
}

export function ListingTable({
  rows,
  page,
  totalPages,
  totalCount,
  cities,
  currentCity,
  currentPropertyType,
}: ListingTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Optimistic local overrides for toggle state
  const [localOverrides, setLocalOverrides] = useState<
    Record<string, { listingEnabled?: boolean; applicationsEnabled?: boolean }>
  >({});

  async function toggleField(
    row: ListingRow,
    field: "listingEnabled" | "applicationsEnabled"
  ) {
    const newValue = !(localOverrides[row.id]?.[field] ?? row[field]);
    setTogglingId(row.id + field);
    setLocalOverrides((prev) => ({
      ...prev,
      [row.id]: { ...prev[row.id], [field]: newValue },
    }));
    try {
      await fetch(`/api/properties/${row.propertyId}/units/${row.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: newValue }),
      });
      toast.success(
        field === "listingEnabled"
          ? newValue
            ? "Unit listed"
            : "Unit unlisted"
          : newValue
            ? "Applications enabled"
            : "Applications disabled"
      );
    } catch {
      // Revert optimistic update
      setLocalOverrides((prev) => ({
        ...prev,
        [row.id]: { ...prev[row.id], [field]: row[field] },
      }));
      toast.error("Failed to update");
    } finally {
      setTogglingId(null);
    }
  }

  function getEffectiveValue(row: ListingRow, field: "listingEnabled" | "applicationsEnabled") {
    return localOverrides[row.id]?.[field] ?? row[field];
  }

  async function handleListAllAvailable() {
    try {
      const res = await fetch("/api/listings/bulk-list", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(`${data.count} unit${data.count !== 1 ? "s" : ""} listed`);
        router.refresh();
      } else {
        toast.error(data.error || "Failed to update");
      }
    } catch {
      toast.error("Failed to update");
    }
  }
  const [occupancyFilter, setOccupancyFilter] =
    useState<OccupancyFilter>("ALL");
  const [listedFilter, setListedFilter] = useState<ListedFilter>("ALL");
  const [viewMode, setViewMode] = useState<"stack" | "table">("table");

  // Navigate with updated searchParams for server-side filtering/pagination
  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      // Reset to page 1 when filters change (unless explicitly setting page)
      if (!("page" in updates)) {
        params.delete("page");
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  // Client-side filtering for search/occupancy/listed (within current page)
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !r.propertyName.toLowerCase().includes(q) &&
          !r.unitNumber.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (occupancyFilter === "AVAILABLE" && r.status !== "AVAILABLE") {
        return false;
      }
      if (occupancyFilter === "OCCUPIED" && r.status !== "OCCUPIED") {
        return false;
      }
      if (listedFilter === "LISTED" && !r.listingEnabled) {
        return false;
      }
      if (listedFilter === "NOT_LISTED" && r.listingEnabled) {
        return false;
      }
      return true;
    });
  }, [rows, search, occupancyFilter, listedFilter]);

  // Group by building for stack view
  const buildingGroups = useMemo(() => {
    const groups: Record<string, { propertyId: string; listings: ListingRow[] }> = {};
    for (const row of filtered) {
      if (!groups[row.propertyName]) {
        groups[row.propertyName] = { propertyId: row.propertyId, listings: [] };
      }
      groups[row.propertyName].listings.push(row);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const columns: Column<ListingRow>[] = [
    {
      key: "property",
      header: "Property",
      sortable: true,
      sortFn: (a, b) => a.propertyName.localeCompare(b.propertyName),
      cell: (row) => (
        <Link
          href={`/dashboard/properties/${row.propertyId}`}
          className="font-medium text-accent-lavender hover:underline"
        >
          {row.propertyName}
        </Link>
      ),
    },
    {
      key: "unit",
      header: "Unit",
      sortable: true,
      sortFn: (a, b) => a.unitNumber.localeCompare(b.unitNumber),
      cell: (row) => (
        <Link
          href={`/dashboard/properties/${row.propertyId}/units/${row.id}`}
          className="hover:underline"
        >
          {row.unitNumber}
        </Link>
      ),
    },
    {
      key: "beds",
      header: "Beds",
      sortable: true,
      sortFn: (a, b) => (a.bedrooms ?? 0) - (b.bedrooms ?? 0),
      cell: (row) => <span className="text-muted-foreground">{row.bedrooms ?? "—"}</span>,
    },
    {
      key: "baths",
      header: "Baths",
      sortable: true,
      sortFn: (a, b) => (a.bathrooms ?? 0) - (b.bathrooms ?? 0),
      cell: (row) => <span className="text-muted-foreground">{row.bathrooms ?? "—"}</span>,
    },
    {
      key: "rent",
      header: "Rent",
      sortable: true,
      sortFn: (a, b) => a.rent - b.rent,
      cell: (row) => formatCurrency(row.rent),
    },
    {
      key: "status",
      header: "Occupancy",
      sortable: true,
      sortFn: (a, b) => a.status.localeCompare(b.status),
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "listing",
      header: "Listed",
      sortable: true,
      sortFn: (a, b) => Number(b.listingEnabled) - Number(a.listingEnabled),
      cell: (row) => {
        const enabled = getEffectiveValue(row, "listingEnabled");
        return (
          <button
            onClick={(e) => { e.stopPropagation(); toggleField(row, "listingEnabled"); }}
            disabled={togglingId === row.id + "listingEnabled"}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              enabled ? "bg-green-500" : "bg-muted"
            )}
            title={enabled ? "Click to unlist" : "Click to list"}
          >
            <span className={cn(
              "inline-block h-4 w-4 rounded-full bg-white transition-transform",
              enabled ? "translate-x-6" : "translate-x-1"
            )} />
          </button>
        );
      },
    },
    {
      key: "applications",
      header: "Applications",
      cell: (row) => {
        const enabled = getEffectiveValue(row, "applicationsEnabled");
        return (
          <button
            onClick={(e) => { e.stopPropagation(); toggleField(row, "applicationsEnabled"); }}
            disabled={togglingId === row.id + "applicationsEnabled"}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              enabled ? "bg-primary" : "bg-muted"
            )}
            title={enabled ? "Accepting — click to disable" : "Not accepting — click to enable"}
          >
            <span className={cn(
              "inline-block h-4 w-4 rounded-full bg-white transition-transform",
              enabled ? "translate-x-6" : "translate-x-1"
            )} />
          </button>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search input */}
        <div className="flex items-center gap-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search units..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleListAllAvailable}>
            <Globe className="mr-1.5 h-3.5 w-3.5" />
            List All Available
          </Button>
        </div>

        {/* Filter groups + view toggle */}
        <div className="flex flex-wrap items-center gap-4">
          {/* City filter (server-side) */}
          {cities.length > 0 && (
            <select
              value={currentCity}
              onChange={(e) => updateParams({ city: e.target.value })}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
            >
              <option value="">All Cities</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          )}

          {/* Property type filter (server-side) */}
          <select
            value={currentPropertyType}
            onChange={(e) => updateParams({ propertyType: e.target.value })}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
          >
            {PROPERTY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          {/* Occupancy filter (client-side within page) */}
          <div className="flex items-center gap-1">
            <FilterPill
              label="All"
              active={occupancyFilter === "ALL"}
              onClick={() => setOccupancyFilter("ALL")}
            />
            <FilterPill
              label="Available"
              active={occupancyFilter === "AVAILABLE"}
              onClick={() => setOccupancyFilter("AVAILABLE")}
            />
            <FilterPill
              label="Occupied"
              active={occupancyFilter === "OCCUPIED"}
              onClick={() => setOccupancyFilter("OCCUPIED")}
            />
          </div>

          {/* Listed filter (client-side within page) */}
          <div className="flex items-center gap-1">
            <FilterPill
              label="All"
              active={listedFilter === "ALL"}
              onClick={() => setListedFilter("ALL")}
            />
            <FilterPill
              label="Listed"
              active={listedFilter === "LISTED"}
              onClick={() => setListedFilter("LISTED")}
            />
            <FilterPill
              label="Not Listed"
              active={listedFilter === "NOT_LISTED"}
              onClick={() => setListedFilter("NOT_LISTED")}
            />
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
            <button
              onClick={() => setViewMode("stack")}
              className={cn(
                "rounded p-1.5 transition-colors",
                viewMode === "stack"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Building stack view"
            >
              <Layers className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={cn(
                "rounded p-1.5 transition-colors",
                viewMode === "table"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Table view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Count label */}
      <p className="text-xs text-muted-foreground">
        {totalCount} unit{totalCount !== 1 ? "s" : ""} total
        {currentCity && <> in {currentCity}</>}
        {currentPropertyType && <> ({PROPERTY_TYPES.find((t) => t.value === currentPropertyType)?.label})</>}
        {viewMode === "stack" && <> &middot; {buildingGroups.length} building{buildingGroups.length !== 1 ? "s" : ""}</>}
      </p>

      {viewMode === "stack" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {buildingGroups.map(([propertyName, { propertyId, listings }]) => (
            <ListingBuildingStack
              key={propertyName}
              propertyName={propertyName}
              propertyId={propertyId}
              listings={listings}
            />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          page={page}
          totalPages={totalPages}
          onPageChange={(p) => updateParams({ page: String(p) })}
          emptyMessage="No units match the current filters."
        />
      )}
    </div>
  );
}

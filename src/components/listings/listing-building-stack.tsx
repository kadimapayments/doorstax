"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Building2, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { ListingRow } from "./listing-table";

interface ListingBuildingStackProps {
  propertyName: string;
  propertyId: string;
  listings: ListingRow[];
}

export function ListingBuildingStack({ propertyName, propertyId, listings }: ListingBuildingStackProps) {
  const [expanded, setExpanded] = useState(false);

  const totalRent = listings.reduce((sum, l) => sum + l.rent, 0);
  const availableCount = listings.filter((l) => l.status === "AVAILABLE").length;
  const occupiedCount = listings.filter((l) => l.status === "OCCUPIED").length;
  const listedCount = listings.filter((l) => l.listingEnabled).length;

  return (
    <Card className="border-border card-glow overflow-hidden animate-fade-in-up">
      <CardContent className="p-5">
        {/* Header — clickable to toggle */}
        <div
          className="flex items-center justify-between gap-3 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && setExpanded(!expanded)}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <Link
                href={`/dashboard/properties/${propertyId}`}
                className="font-bold text-sm truncate hover:text-primary transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                {propertyName}
              </Link>
              <p className="text-xs text-muted-foreground">
                {listings.length} unit{listings.length !== 1 ? "s" : ""} &middot;{" "}
                {availableCount} available &middot; {occupiedCount} occupied
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-sm font-semibold text-green-600 dark:text-green-400">
              {formatCurrency(totalRent)}/mo
            </span>
            <ChevronRight
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-200",
                expanded && "rotate-90"
              )}
            />
          </div>
        </div>

        {/* Quick stats */}
        {!expanded && (
          <div className="flex gap-3 mt-3 text-xs text-muted-foreground">
            <span>{listedCount}/{listings.length} listed</span>
          </div>
        )}

        {/* Expanded unit list */}
        {expanded && (
          <div className="mt-4 space-y-2 animate-unstack">
            {listings.map((listing) => (
              <Link
                key={listing.id}
                href={`/dashboard/properties/${listing.propertyId}/units/${listing.id}`}
              >
                <div className="rounded-lg border border-border p-3 flex items-center justify-between gap-2 hover:border-border-hover transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      Unit {listing.unitNumber}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {listing.bedrooms ?? "—"} bed &middot; {listing.bathrooms ?? "—"} bath
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-medium">{formatCurrency(listing.rent)}</span>
                    <StatusBadge status={listing.status} />
                    <span
                      className={cn(
                        "text-[10px] font-medium px-1.5 py-0.5 rounded",
                        listing.listingEnabled
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {listing.listingEnabled ? "Listed" : "Unlisted"}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

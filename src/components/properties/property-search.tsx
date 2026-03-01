"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Search, MapPin, Home, Building2, Landmark, Store } from "lucide-react";

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

const propertyTypeConfig: Record<string, { label: string; icon: typeof Home }> = {
  SINGLE_FAMILY: { label: "Single Family", icon: Home },
  MULTIFAMILY: { label: "Multifamily", icon: Building2 },
  OFFICE: { label: "Office", icon: Landmark },
  COMMERCIAL: { label: "Commercial", icon: Store },
};

export function PropertySearch({ properties }: { properties: PropertyData[] }) {
  const [search, setSearch] = useState("");

  const filtered = properties.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.address.toLowerCase().includes(q) ||
      p.city.toLowerCase().includes(q) ||
      p.state.toLowerCase().includes(q) ||
      p.zip.includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search properties..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((property) => {
          const occupied = property.units.filter((u) => u.status === "OCCUPIED").length;
          const total = property.units.length;
          const totalRent = property.units.reduce((sum, u) => sum + u.rentAmount, 0);
          const typeInfo = propertyTypeConfig[property.propertyType] || propertyTypeConfig.MULTIFAMILY;
          const TypeIcon = typeInfo.icon;

          return (
            <Link key={property.id} href={`/dashboard/properties/${property.id}`}>
              <Card className="border-border transition-colors hover:border-border-hover">
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
    </div>
  );
}

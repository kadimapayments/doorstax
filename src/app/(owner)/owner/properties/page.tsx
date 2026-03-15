"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Building2, Home } from "lucide-react";

interface UnitDetail {
  id: string;
  unitNumber: string;
  status: string;
  rentAmount: number;
  tenantName: string | null;
}

interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  propertyType: string;
  units: UnitDetail[];
  totalRent: number;
  occupied: number;
  totalUnits: number;
}

export default function OwnerPropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/owner/properties")
      .then((r) => r.json())
      .then(setProperties)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Properties</h1>
        <p className="text-muted-foreground">
          View your properties and unit details.
        </p>
      </div>

      {properties.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-lg font-medium">No properties yet</p>
            <p className="text-sm text-muted-foreground">
              Properties assigned to you will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {properties.map((p) => {
            const pct =
              p.totalUnits > 0
                ? Math.round((p.occupied / p.totalUnits) * 100)
                : 0;
            const isExpanded = expanded[p.id] ?? false;

            return (
              <Card key={p.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{p.name}</CardTitle>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {p.address}, {p.city}, {p.state} {p.zip}
                      </p>
                    </div>
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                      {p.propertyType}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-3 text-center text-sm">
                    <div>
                      <p className="text-muted-foreground">Units</p>
                      <p className="text-lg font-semibold">{p.totalUnits}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Occupied</p>
                      <p className="text-lg font-semibold">
                        {p.occupied}/{p.totalUnits}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Rent</p>
                      <p className="text-lg font-semibold">
                        {formatCurrency(p.totalRent)}
                      </p>
                    </div>
                  </div>

                  {/* Occupancy bar */}
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Occupancy</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Expand/collapse units */}
                  {p.units.length > 0 && (
                    <div>
                      <button
                        onClick={() =>
                          setExpanded((prev) => ({
                            ...prev,
                            [p.id]: !prev[p.id],
                          }))
                        }
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {isExpanded
                          ? "Hide unit details"
                          : `Show ${p.units.length} unit${p.units.length !== 1 ? "s" : ""}`}
                      </button>

                      {isExpanded && (
                        <div className="mt-3 space-y-2">
                          {p.units.map((u) => (
                            <div
                              key={u.id}
                              className="flex items-center justify-between rounded-lg border p-3 text-sm"
                            >
                              <div className="flex items-center gap-2">
                                <Home className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">
                                  Unit {u.unitNumber}
                                </span>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                    u.status === "OCCUPIED"
                                      ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                                  }`}
                                >
                                  {u.status}
                                </span>
                              </div>
                              <div className="text-right">
                                <p className="font-medium">
                                  {formatCurrency(u.rentAmount)}
                                </p>
                                {u.tenantName && (
                                  <p className="text-xs text-muted-foreground">
                                    {u.tenantName}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

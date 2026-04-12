"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Car, MapPin, Loader2, Calendar } from "lucide-react";

interface ParkingAssignment {
  id: string;
  spaceNumber: string;
  spaceType: string;
  spaceLevel: string | null;
  spaceLocation: string | null;
  lotName: string;
  lotType: string;
  propertyName: string;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleYear: string | null;
  vehicleColor: string | null;
  licensePlate: string | null;
  licensePlateState: string | null;
  isIncluded: boolean;
  monthlyCharge: number;
  assignedAt: string;
  expiresAt: string | null;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export default function TenantParkingPage() {
  const [assignments, setAssignments] = useState<ParkingAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tenant/parking")
      .then((r) => (r.ok ? r.json() : { assignments: [] }))
      .then((data) => setAssignments(data.assignments || []))
      .catch(() => setAssignments([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parking"
        description="Your assigned parking spaces and vehicle information."
      />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : assignments.length === 0 ? (
        <Card className="border-border">
          <CardContent className="py-12 text-center">
            <Car className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No parking assigned</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
              You don&apos;t have any parking spaces assigned. Contact your
              property manager if you need parking.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {assignments.map((a) => {
            const expiringSoon =
              a.expiresAt &&
              new Date(a.expiresAt).getTime() - Date.now() <
                30 * 24 * 60 * 60 * 1000;
            return (
              <Card key={a.id} className="border-border">
                <CardContent className="p-5 space-y-4">
                  {/* Space number header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Space
                      </p>
                      <p className="text-3xl font-bold">{a.spaceNumber}</p>
                    </div>
                    {a.isIncluded ? (
                      <Badge
                        variant="outline"
                        className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                      >
                        Included
                      </Badge>
                    ) : (
                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          {fmt(a.monthlyCharge)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">/mo</p>
                      </div>
                    )}
                  </div>

                  {/* Location */}
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium">{a.lotName}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {a.lotType}
                      </Badge>
                    </div>
                    {a.spaceLevel && (
                      <p className="text-xs text-muted-foreground ml-6">
                        Level: {a.spaceLevel}
                      </p>
                    )}
                    {a.spaceLocation && (
                      <p className="text-xs text-muted-foreground ml-6">
                        {a.spaceLocation}
                      </p>
                    )}
                  </div>

                  {/* Vehicle */}
                  {(a.vehicleMake || a.licensePlate) && (
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <Car className="h-3.5 w-3.5" />
                        Vehicle
                      </div>
                      {a.vehicleMake && (
                        <p className="text-sm">
                          {a.vehicleYear} {a.vehicleColor} {a.vehicleMake}{" "}
                          {a.vehicleModel}
                        </p>
                      )}
                      {a.licensePlate && (
                        <p className="text-xs text-muted-foreground font-mono">
                          {a.licensePlateState && `${a.licensePlateState} `}
                          {a.licensePlate}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Assigned {new Date(a.assignedAt).toLocaleDateString()}
                    </span>
                    {expiringSoon && (
                      <Badge variant="destructive" className="text-[10px]">
                        Expiring Soon
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

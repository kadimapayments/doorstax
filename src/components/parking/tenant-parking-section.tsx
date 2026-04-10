"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Car, Plus } from "lucide-react";
import { toast } from "sonner";
import { AssignParkingDialog } from "./assign-parking-dialog";

interface ParkingAssignmentData {
  id: string;
  isIncluded: boolean;
  monthlyCharge: number;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleColor: string | null;
  vehicleYear: string | null;
  licensePlate: string | null;
  licensePlateState: string | null;
  space: {
    number: string;
    type: string;
    level: string | null;
    lot: { name: string; type: string };
  };
}

interface TenantParkingSectionProps {
  tenantId: string;
  tenantUnitId: string | null;
  propertyId: string | null;
  assignments: ParkingAssignmentData[];
  roommates: Array<{ id: string; name: string; splitPercentage?: number }>;
}

export function TenantParkingSection({
  tenantId,
  tenantUnitId,
  propertyId,
  assignments,
  roommates,
}: TenantParkingSectionProps) {
  const router = useRouter();
  const [showAssignDialog, setShowAssignDialog] = useState(false);

  async function handleRevoke(assignmentId: string) {
    if (!confirm("Revoke this parking assignment?")) return;
    try {
      const res = await fetch(`/api/parking/assignments/${assignmentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke" }),
      });
      if (res.ok) {
        toast.success("Assignment revoked");
        router.refresh();
      } else {
        toast.error("Failed to revoke");
      }
    } catch {
      toast.error("Failed to revoke");
    }
  }

  return (
    <>
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Car className="h-4 w-4 text-muted-foreground" />
              Parking
            </CardTitle>
            {propertyId && tenantUnitId && (
              <button
                onClick={() => setShowAssignDialog(true)}
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Assign Space
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No parking spaces assigned
            </p>
          ) : (
            assignments.map((a) => (
              <div key={a.id} className="rounded-lg border p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      Space {a.space.number}{" "}
                      <span className="text-muted-foreground">
                        &middot; {a.space.lot.name}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.space.type.replace(/_/g, " ")}
                      {a.space.level && ` \u00b7 ${a.space.level}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={
                        a.isIncluded
                          ? "text-xs text-green-600"
                          : "text-xs text-amber-600 font-medium"
                      }
                    >
                      {a.isIncluded
                        ? "Included"
                        : `$${Number(a.monthlyCharge).toFixed(2)}/mo`}
                    </span>
                    <button
                      onClick={() => handleRevoke(a.id)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
                {(a.vehicleMake || a.licensePlate) && (
                  <p className="text-xs text-muted-foreground">
                    {[
                      a.vehicleColor,
                      a.vehicleYear,
                      a.vehicleMake,
                      a.vehicleModel,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    {a.licensePlate &&
                      ` \u00b7 ${a.licensePlate}${a.licensePlateState ? ` (${a.licensePlateState})` : ""}`}
                  </p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {propertyId && tenantUnitId && (
        <AssignParkingDialog
          open={showAssignDialog}
          onClose={() => setShowAssignDialog(false)}
          propertyId={propertyId}
          unitId={tenantUnitId}
          tenantId={tenantId}
          tenants={roommates}
          onAssigned={() => router.refresh()}
        />
      )}
    </>
  );
}

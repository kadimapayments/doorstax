"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Car, Plus } from "lucide-react";
import { toast } from "sonner";
import { AssignParkingDialog } from "./assign-parking-dialog";
import { showConfirm } from "@/components/admin/dialog-prompt";

interface ParkingAssignmentData {
  id: string;
  isIncluded: boolean;
  monthlyCharge: number;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleColor: string | null;
  vehicleYear: string | null;
  licensePlate: string | null;
  space: {
    number: string;
    lot: { name: string; type: string };
  };
  tenant: {
    user: { name: string | null } | null;
  } | null;
}

interface UnitParkingSectionProps {
  unitId: string;
  propertyId: string;
  includedParkingSpaces: number;
  assignments: ParkingAssignmentData[];
  tenants: Array<{ id: string; name: string; splitPercentage?: number }>;
}

export function UnitParkingSection({
  unitId,
  propertyId,
  includedParkingSpaces,
  assignments,
  tenants,
}: UnitParkingSectionProps) {
  const router = useRouter();
  const [showAssignDialog, setShowAssignDialog] = useState(false);

  async function handleRevoke(assignmentId: string) {
    if (!await showConfirm({ title: "Revoke Parking Assignment?", description: "This will remove the parking spot assignment. The spot will become available for reassignment.", confirmLabel: "Revoke Assignment", destructive: true })) return;
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
            <button
              onClick={() => setShowAssignDialog(true)}
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Assign Space
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No parking spaces assigned to this unit
            </p>
          ) : (
            assignments.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">
                      #{a.space.number}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      Space {a.space.number}
                      <span className="text-muted-foreground">
                        {" "}
                        &middot; {a.space.lot.name}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {a.tenant?.user?.name || "Unassigned"}
                      {a.vehicleMake &&
                        ` \u00b7 ${[a.vehicleColor, a.vehicleMake, a.vehicleModel].filter(Boolean).join(" ")}`}
                      {a.licensePlate && ` \u00b7 ${a.licensePlate}`}
                    </p>
                  </div>
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
            ))
          )}

          <p className="text-xs text-muted-foreground pt-1">
            {includedParkingSpaces > 0
              ? `${includedParkingSpaces} space${includedParkingSpaces !== 1 ? "s" : ""} included with lease`
              : "No parking included with lease"}
          </p>
        </CardContent>
      </Card>

      <AssignParkingDialog
        open={showAssignDialog}
        onClose={() => setShowAssignDialog(false)}
        propertyId={propertyId}
        unitId={unitId}
        tenants={tenants}
        onAssigned={() => router.refresh()}
      />
    </>
  );
}

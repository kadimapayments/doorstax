"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Map as MapIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TenantOption {
  id: string;
  name: string;
  splitPercentage?: number;
}

interface AssignParkingDialogProps {
  open: boolean;
  onClose: () => void;
  propertyId: string;
  unitId?: string;
  tenantId?: string;
  tenants: TenantOption[];
  onAssigned: () => void;
}

interface Lot {
  id: string;
  name: string;
  availableSpaces: number;
  layoutImageUrl?: string | null;
}

interface Space {
  id: string;
  number: string;
  type: string;
  level: string | null;
  monthlyRate: number;
  isAssignable: boolean;
  isActive: boolean;
  assignments: Array<{ status: string }>;
}

export function AssignParkingDialog({
  open,
  onClose,
  propertyId,
  unitId,
  tenantId,
  tenants,
  onAssigned,
}: AssignParkingDialogProps) {
  const [lots, setLots] = useState<Lot[]>([]);
  const [selectedLotId, setSelectedLotId] = useState("");
  const [availableSpaces, setAvailableSpaces] = useState<Space[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState("");
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  // Vehicle info
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [licensePlateState, setLicensePlateState] = useState("");

  // Billing
  const [isIncluded, setIsIncluded] = useState(true);
  const [monthlyCharge, setMonthlyCharge] = useState(0);
  const [billingMode, setBillingMode] = useState<"single" | "split">("single");
  const [chargedTenantId, setChargedTenantId] = useState(tenantId || "");
  const [customSplits, setCustomSplits] = useState<Record<string, number>>({});

  const [submitting, setSubmitting] = useState(false);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedLotId("");
      setSelectedSpaceId("");
      setSelectedSpace(null);
      setAvailableSpaces([]);
      setVehicleMake("");
      setVehicleModel("");
      setVehicleYear("");
      setVehicleColor("");
      setLicensePlate("");
      setLicensePlateState("");
      setBillingMode("single");
      setChargedTenantId(tenantId || "");
      setExpandedImage(null);
    }
  }, [open, tenantId]);

  // Fetch available lots when dialog opens
  useEffect(() => {
    if (!open || !propertyId) return;
    fetch(`/api/parking/lots?propertyId=${propertyId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setLots(list);
      })
      .catch(() => setLots([]));
  }, [open, propertyId]);

  // When lot is selected, fetch available spaces
  useEffect(() => {
    if (!selectedLotId) {
      setAvailableSpaces([]);
      return;
    }
    fetch(`/api/parking/lots/${selectedLotId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const spaces = ((data.spaces || []) as Space[]).filter(
          (s) =>
            s.isAssignable &&
            s.isActive &&
            !s.assignments?.some((a) => a.status === "ACTIVE")
        );
        setAvailableSpaces(spaces);
      })
      .catch(() => setAvailableSpaces([]));
  }, [selectedLotId]);

  // Initialize custom splits from tenants
  useEffect(() => {
    if (tenants.length > 0) {
      const splits: Record<string, number> = {};
      const hasRealSplits = tenants.every(
        (t) => t.splitPercentage && t.splitPercentage > 0
      );
      if (hasRealSplits) {
        tenants.forEach((t) => {
          splits[t.id] = t.splitPercentage || 0;
        });
      } else {
        const even = Math.floor(100 / tenants.length);
        const remainder = 100 - even * tenants.length;
        tenants.forEach((t, i) => {
          splits[t.id] = even + (i === 0 ? remainder : 0);
        });
      }
      setCustomSplits(splits);
    }
  }, [tenants]);

  // When space is selected, set default rate
  useEffect(() => {
    const space = availableSpaces.find((s) => s.id === selectedSpaceId) || null;
    setSelectedSpace(space);
    if (space && space.monthlyRate > 0) {
      setMonthlyCharge(space.monthlyRate);
      setIsIncluded(false);
    } else if (space) {
      setMonthlyCharge(0);
      setIsIncluded(true);
    }
  }, [selectedSpaceId, availableSpaces]);

  const selectedLot = lots.find((l) => l.id === selectedLotId);
  const totalSplitPct = Object.values(customSplits).reduce(
    (s, p) => s + p,
    0
  );
  const isValidSplit = Math.abs(totalSplitPct - 100) < 0.01;

  async function handleAssign() {
    if (!selectedSpaceId) {
      toast.error("Select a parking space");
      return;
    }

    // Validation
    if (!isIncluded && tenants.length > 1 && billingMode === "single") {
      if (!chargedTenantId) {
        toast.error("Select which tenant to charge");
        return;
      }
    }
    if (!isIncluded && tenants.length > 1 && billingMode === "split") {
      if (!isValidSplit) {
        toast.error("Split percentages must total 100%");
        return;
      }
    }

    setSubmitting(true);
    try {
      interface AssignBody {
        spaceId: string;
        unitId?: string;
        tenantId?: string;
        vehicleMake: string;
        vehicleModel: string;
        vehicleYear: string;
        vehicleColor: string;
        licensePlate: string;
        licensePlateState: string;
        isIncluded: boolean;
        monthlyCharge: number;
        notes: string;
        splitBilling?: boolean;
        splits?: Array<{ tenantId: string; percentage: number; amount: number }>;
      }

      const body: AssignBody = {
        spaceId: selectedSpaceId,
        unitId,
        vehicleMake,
        vehicleModel,
        vehicleYear,
        vehicleColor,
        licensePlate,
        licensePlateState,
        isIncluded,
        monthlyCharge: isIncluded ? 0 : monthlyCharge,
        notes: "",
      };

      if (!isIncluded && tenants.length > 1) {
        if (billingMode === "single") {
          body.tenantId = chargedTenantId;
          const t = tenants.find((x) => x.id === chargedTenantId);
          body.notes = `Charged to ${t?.name || "tenant"}`;
        } else {
          // Split mode
          body.tenantId = chargedTenantId || tenants[0].id;
          body.splitBilling = true;
          body.splits = tenants.map((t) => {
            const pct = customSplits[t.id] || 0;
            return {
              tenantId: t.id,
              percentage: pct,
              amount: Math.round(monthlyCharge * (pct / 100) * 100) / 100,
            };
          });
          body.notes = `Split: ${tenants
            .map((t) => `${t.name} ${customSplits[t.id] || 0}%`)
            .join(", ")}`;
        }
      } else {
        body.tenantId = chargedTenantId || tenantId || tenants[0]?.id || undefined;
      }

      const res = await fetch("/api/parking/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("Parking space assigned");
        onAssigned();
        onClose();
      } else {
        toast.error(data.error || "Failed to assign space");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign Parking Space</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Lot selector */}
            <div className="space-y-1.5">
              <Label>Parking Lot</Label>
              <select
                value={selectedLotId}
                onChange={(e) => {
                  setSelectedLotId(e.target.value);
                  setSelectedSpaceId("");
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select lot...</option>
                {lots.map((lot) => (
                  <option key={lot.id} value={lot.id}>
                    {lot.name} ({lot.availableSpaces} available)
                  </option>
                ))}
              </select>
            </div>

            {/* Layout map preview */}
            {selectedLot?.layoutImageUrl &&
              !selectedLot.layoutImageUrl.toLowerCase().endsWith(".pdf") && (
                <div className="rounded-lg border overflow-hidden relative bg-muted/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedLot.layoutImageUrl}
                    alt="Lot layout"
                    className="w-full h-32 object-cover cursor-pointer"
                    onClick={() =>
                      setExpandedImage(selectedLot.layoutImageUrl || null)
                    }
                  />
                  <div className="absolute bottom-1 right-1">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedImage(selectedLot.layoutImageUrl || null)
                      }
                      className="rounded-md bg-background/90 px-2 py-1 text-[10px] font-medium border flex items-center gap-1"
                    >
                      <MapIcon className="h-3 w-3" />
                      Expand
                    </button>
                  </div>
                </div>
              )}

            {/* Space selector */}
            {selectedLotId && (
              <div className="space-y-1.5">
                <Label>Space</Label>
                <select
                  value={selectedSpaceId}
                  onChange={(e) => setSelectedSpaceId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select space...</option>
                  {availableSpaces.map((space) => (
                    <option key={space.id} value={space.id}>
                      #{space.number} \u2014 {space.type.replace(/_/g, " ")}
                      {space.level ? ` (${space.level})` : ""}
                      {space.monthlyRate > 0
                        ? ` \u2014 $${space.monthlyRate}/mo`
                        : " \u2014 Free"}
                    </option>
                  ))}
                </select>
                {availableSpaces.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No available spaces in this lot
                  </p>
                )}
              </div>
            )}

            {/* Vehicle info */}
            {selectedSpaceId && (
              <div className="space-y-2">
                <Label className="text-sm">Vehicle Information</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Make (Toyota)"
                    value={vehicleMake}
                    onChange={(e) => setVehicleMake(e.target.value)}
                  />
                  <Input
                    placeholder="Model (Camry)"
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                  />
                  <Input
                    placeholder="Year"
                    value={vehicleYear}
                    onChange={(e) => setVehicleYear(e.target.value)}
                  />
                  <Input
                    placeholder="Color"
                    value={vehicleColor}
                    onChange={(e) => setVehicleColor(e.target.value)}
                  />
                  <Input
                    placeholder="License Plate"
                    value={licensePlate}
                    onChange={(e) => setLicensePlate(e.target.value)}
                  />
                  <Input
                    placeholder="State"
                    value={licensePlateState}
                    onChange={(e) => setLicensePlateState(e.target.value)}
                    maxLength={2}
                  />
                </div>
              </div>
            )}

            {/* Billing */}
            {selectedSpaceId && (
              <div className="space-y-3">
                <Label className="text-sm">Billing</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsIncluded(true);
                      setMonthlyCharge(0);
                    }}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2 text-sm font-medium",
                      isIncluded &&
                        "bg-primary text-primary-foreground border-primary"
                    )}
                  >
                    Included with Lease
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsIncluded(false);
                      setMonthlyCharge(selectedSpace?.monthlyRate || 0);
                    }}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2 text-sm font-medium",
                      !isIncluded &&
                        "bg-primary text-primary-foreground border-primary"
                    )}
                  >
                    Extra Charge
                  </button>
                </div>

                {!isIncluded && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Monthly Charge</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={monthlyCharge}
                        onChange={(e) =>
                          setMonthlyCharge(Number(e.target.value))
                        }
                      />
                    </div>

                    {/* Single tenant — just show who gets charged */}
                    {tenants.length === 1 && (
                      <p className="text-xs text-muted-foreground">
                        {tenants[0].name} will be charged $
                        {monthlyCharge.toFixed(2)}/mo
                      </p>
                    )}

                    {/* Multiple tenants — billing mode choice */}
                    {tenants.length > 1 && (
                      <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                        <p className="text-xs font-medium">
                          Who pays for this space?
                        </p>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setBillingMode("single")}
                            className={cn(
                              "flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium",
                              billingMode === "single" &&
                                "bg-primary text-primary-foreground border-primary"
                            )}
                          >
                            One Tenant
                          </button>
                          <button
                            type="button"
                            onClick={() => setBillingMode("split")}
                            className={cn(
                              "flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium",
                              billingMode === "split" &&
                                "bg-primary text-primary-foreground border-primary"
                            )}
                          >
                            Split Between Roommates
                          </button>
                        </div>

                        {billingMode === "single" && (
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">
                              Charge this tenant
                            </Label>
                            <select
                              value={chargedTenantId}
                              onChange={(e) =>
                                setChargedTenantId(e.target.value)
                              }
                              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              <option value="">Select tenant...</option>
                              {tenants.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                            </select>
                            {chargedTenantId && (
                              <p className="text-xs text-muted-foreground">
                                {
                                  tenants.find(
                                    (t) => t.id === chargedTenantId
                                  )?.name
                                }{" "}
                                will be charged ${monthlyCharge.toFixed(2)}/mo
                              </p>
                            )}
                          </div>
                        )}

                        {billingMode === "split" && (
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">
                              Set each tenant&apos;s share of $
                              {monthlyCharge.toFixed(2)}/mo
                            </p>
                            {tenants.map((t) => {
                              const pct = customSplits[t.id] || 0;
                              const amt =
                                Math.round(monthlyCharge * (pct / 100) * 100) /
                                100;
                              return (
                                <div
                                  key={t.id}
                                  className="flex items-center gap-2"
                                >
                                  <span className="text-xs flex-1 min-w-0 truncate">
                                    {t.name}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      min={0}
                                      max={100}
                                      value={pct}
                                      onChange={(e) =>
                                        setCustomSplits((prev) => ({
                                          ...prev,
                                          [t.id]: Number(e.target.value),
                                        }))
                                      }
                                      className="w-14 rounded-md border border-input bg-background px-2 py-1 text-xs text-right"
                                    />
                                    <span className="text-[10px] text-muted-foreground">
                                      %
                                    </span>
                                  </div>
                                  <span className="text-xs font-medium w-16 text-right">
                                    ${amt.toFixed(2)}
                                  </span>
                                </div>
                              );
                            })}
                            <div
                              className={cn(
                                "text-xs font-medium pt-1 border-t",
                                isValidSplit ? "text-green-600" : "text-red-500"
                              )}
                            >
                              Total: {totalSplitPct}%{" "}
                              {isValidSplit ? "\u2713" : "(must equal 100%)"}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button
                onClick={handleAssign}
                disabled={submitting || !selectedSpaceId}
              >
                {submitting && (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                )}
                Assign Space
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Layout image viewer */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setExpandedImage(null)}
        >
          <div className="relative max-w-6xl max-h-[90vh] w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={expandedImage}
              alt="Layout"
              className="w-full h-full object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </>
  );
}

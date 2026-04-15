"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Car,
  Plus,
  Loader2,
  DollarSign,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Upload,
  Maximize2,
  X,
  Map,
} from "lucide-react";
import { toast } from "sonner";
import { showConfirm } from "@/components/admin/dialog-prompt";
import { cn } from "@/lib/utils";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

interface Lot {
  id: string;
  name: string;
  type: string;
  totalSpaces: number;
  assignedSpaces: number;
  availableSpaces: number;
  monthlyRevenue: number;
  layoutImageUrl: string | null;
  property: { id: string; name: string };
}

interface Space {
  id: string;
  number: string;
  type: string;
  level: string | null;
  monthlyRate: number;
  isActive: boolean;
  assignments: Array<{
    id: string;
    isIncluded: boolean;
    monthlyCharge: number;
    vehicleMake: string | null;
    vehicleModel: string | null;
    licensePlate: string | null;
    tenant: { user: { name: string | null } } | null;
    unit: { unitNumber: string } | null;
  }>;
}

interface Stats {
  totalSpaces: number;
  assignedSpaces: number;
  availableSpaces: number;
  occupancyRate: number;
  monthlyRevenue: number;
  typeBreakdown: Record<string, number>;
  expiringSoon: number;
}

interface Property {
  id: string;
  name: string;
}

interface UnitOption {
  id: string;
  unitNumber: string;
  tenantProfiles: { id: string; user: { name: string | null } | null }[];
}

export default function ParkingPage() {
  const [lots, setLots] = useState<Lot[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyFilter, setPropertyFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [expandedLots, setExpandedLots] = useState<Set<string>>(new Set());
  const [lotSpaces, setLotSpaces] = useState<Record<string, Space[]>>({});

  // Add Lot dialog
  const [showAddLot, setShowAddLot] = useState(false);
  const [lotName, setLotName] = useState("");
  const [lotType, setLotType] = useState("SURFACE");
  const [lotTotalSpaces, setLotTotalSpaces] = useState(10);
  const [lotDefaultRate, setLotDefaultRate] = useState(0);
  const [lotPropertyId, setLotPropertyId] = useState("");
  const [creatingLot, setCreatingLot] = useState(false);

  // Assign Space dialog
  const [assignSpace, setAssignSpace] = useState<Space | null>(null);
  const [assignLotId, setAssignLotId] = useState<string | null>(null);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [assignUnitId, setAssignUnitId] = useState("");
  const [assignTenantId, setAssignTenantId] = useState("");
  const [assignIsIncluded, setAssignIsIncluded] = useState(true);
  const [assignMonthlyCharge, setAssignMonthlyCharge] = useState(0);
  const [assignVehicleMake, setAssignVehicleMake] = useState("");
  const [assignVehicleModel, setAssignVehicleModel] = useState("");
  const [assignLicensePlate, setAssignLicensePlate] = useState("");
  const [assigning, setAssigning] = useState(false);

  // Layout image
  const [uploadingLayoutLotId, setUploadingLayoutLotId] = useState<string | null>(null);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const url = propertyFilter
        ? `/api/parking/lots?propertyId=${propertyFilter}`
        : "/api/parking/lots";
      const statsUrl = propertyFilter
        ? `/api/parking/stats?propertyId=${propertyFilter}`
        : "/api/parking/stats";

      const [lotsRes, statsRes, propRes] = await Promise.all([
        fetch(url),
        fetch(statsUrl),
        fetch("/api/properties"),
      ]);

      if (lotsRes.ok) setLots(await lotsRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      if (propRes.ok) {
        const data = await propRes.json();
        const list = Array.isArray(data) ? data : data.properties || [];
        setProperties(list.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })));
      }
    } catch {
      toast.error("Failed to load parking data");
    } finally {
      setLoading(false);
    }
  }, [propertyFilter]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function toggleLot(lotId: string) {
    setExpandedLots((prev) => {
      const next = new Set(prev);
      if (next.has(lotId)) next.delete(lotId);
      else next.add(lotId);
      return next;
    });

    if (!lotSpaces[lotId]) {
      try {
        const res = await fetch(`/api/parking/lots/${lotId}`);
        if (res.ok) {
          const data = await res.json();
          setLotSpaces((prev) => ({ ...prev, [lotId]: data.spaces || [] }));
        }
      } catch { /* ignore */ }
    }
  }

  async function createLot() {
    if (!lotName || !lotPropertyId) {
      toast.error("Property and lot name are required");
      return;
    }
    setCreatingLot(true);
    try {
      const res = await fetch("/api/parking/lots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: lotPropertyId,
          name: lotName,
          type: lotType,
          totalSpaces: lotTotalSpaces,
          defaultRate: lotDefaultRate,
        }),
      });
      if (res.ok) {
        toast.success("Parking lot created");
        setShowAddLot(false);
        setLotName("");
        fetchAll();
      } else {
        toast.error("Failed to create lot");
      }
    } catch {
      toast.error("Failed to create lot");
    } finally {
      setCreatingLot(false);
    }
  }

  async function openAssign(space: Space, lotId: string) {
    setAssignSpace(space);
    setAssignLotId(lotId);
    setAssignIsIncluded(space.monthlyRate === 0);
    setAssignMonthlyCharge(space.monthlyRate);
    setAssignUnitId("");
    setAssignTenantId("");
    setAssignVehicleMake("");
    setAssignVehicleModel("");
    setAssignLicensePlate("");

    // Fetch units for the lot's property
    const lot = lots.find((l) => l.id === lotId);
    if (lot) {
      try {
        const res = await fetch(`/api/properties/${lot.property.id}`);
        if (res.ok) {
          const data = await res.json();
          setUnits(data.units || []);
        }
      } catch { /* ignore */ }
    }
  }

  async function saveAssignment() {
    if (!assignSpace) return;
    setAssigning(true);
    try {
      const res = await fetch("/api/parking/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spaceId: assignSpace.id,
          unitId: assignUnitId || undefined,
          tenantId: assignTenantId || undefined,
          isIncluded: assignIsIncluded,
          monthlyCharge: assignIsIncluded ? 0 : assignMonthlyCharge,
          vehicleMake: assignVehicleMake,
          vehicleModel: assignVehicleModel,
          licensePlate: assignLicensePlate,
        }),
      });
      if (res.ok) {
        toast.success("Space assigned");
        setAssignSpace(null);
        if (assignLotId) {
          // Refresh lot spaces
          const lotRes = await fetch(`/api/parking/lots/${assignLotId}`);
          if (lotRes.ok) {
            const data = await lotRes.json();
            setLotSpaces((prev) => ({ ...prev, [assignLotId]: data.spaces || [] }));
          }
        }
        fetchAll();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to assign");
      }
    } catch {
      toast.error("Failed to assign");
    } finally {
      setAssigning(false);
    }
  }

  async function revokeAssignment(assignmentId: string, lotId: string) {
    if (!await showConfirm({ title: "Revoke Parking Assignment?", description: "This will remove the parking spot assignment. The spot will become available for reassignment.", confirmLabel: "Revoke Assignment", destructive: true })) return;
    try {
      const res = await fetch(`/api/parking/assignments/${assignmentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke" }),
      });
      if (res.ok) {
        toast.success("Assignment revoked");
        const lotRes = await fetch(`/api/parking/lots/${lotId}`);
        if (lotRes.ok) {
          const data = await lotRes.json();
          setLotSpaces((prev) => ({ ...prev, [lotId]: data.spaces || [] }));
        }
        fetchAll();
      }
    } catch {
      toast.error("Failed to revoke");
    }
  }

  async function handleLayoutUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    lotId: string
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large. Maximum 10MB.");
      return;
    }

    setUploadingLayoutLotId(lotId);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`/api/parking/lots/${lotId}/layout`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Layout uploaded");
        // Update local state
        setLots((prev) =>
          prev.map((l) =>
            l.id === lotId ? { ...l, layoutImageUrl: data.url } : l
          )
        );
      } else {
        toast.error(data.error || "Upload failed");
      }
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploadingLayoutLotId(null);
      // Reset input so the same file can be re-uploaded
      e.target.value = "";
    }
  }

  async function handleDeleteLayout(lotId: string) {
    if (!await showConfirm({ title: "Remove Layout Image?", description: "This will delete the parking lot layout image. You can upload a new one later.", confirmLabel: "Remove Image", destructive: true })) return;
    try {
      const res = await fetch(`/api/parking/lots/${lotId}/layout`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Layout removed");
        setLots((prev) =>
          prev.map((l) =>
            l.id === lotId ? { ...l, layoutImageUrl: null } : l
          )
        );
      } else {
        toast.error("Failed to remove");
      }
    } catch {
      toast.error("Failed to remove");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parking Management"
        description="Manage parking lots, spaces, and assignments across your properties."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchAll}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setShowAddLot(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Lot
            </Button>
          </div>
        }
      />

      {/* Property filter */}
      {properties.length > 1 && (
        <div className="flex items-center gap-3">
          <Label className="text-sm">Property:</Label>
          <select
            value={propertyFilter}
            onChange={(e) => setPropertyFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            <option value="">All Properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Stats cards */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Car className="h-4 w-4" />
                <span className="text-xs">Total Spaces</span>
              </div>
              <p className="text-2xl font-bold">{stats.totalSpaces}</p>
              <p className="text-xs text-muted-foreground">
                {lots.length} lot{lots.length !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs">Assigned</span>
              </div>
              <p className="text-2xl font-bold">{stats.assignedSpaces}</p>
              <p className="text-xs text-muted-foreground">
                {Math.round(stats.occupancyRate * 100)}% occupied
              </p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-500 mb-1">
                <Car className="h-4 w-4" />
                <span className="text-xs">Available</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{stats.availableSpaces}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <DollarSign className="h-4 w-4" />
                <span className="text-xs">Monthly Revenue</span>
              </div>
              <p className="text-2xl font-bold">{fmt(stats.monthlyRevenue)}</p>
              <p className="text-xs text-muted-foreground">
                {fmt(stats.monthlyRevenue * 12)}/year
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="lots">
        <TabsList>
          <TabsTrigger value="lots">Lots & Spaces</TabsTrigger>
        </TabsList>

        <TabsContent value="lots" className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : lots.length === 0 ? (
            <Card className="border-border">
              <CardContent className="py-12 text-center">
                <Car className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No parking lots yet</h3>
                <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                  Create a parking lot to start managing spaces and assignments for your properties.
                </p>
                <Button className="mt-4" size="sm" onClick={() => setShowAddLot(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add First Lot
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {lots.map((lot) => {
                const isExpanded = expandedLots.has(lot.id);
                const occupancyPct = lot.totalSpaces > 0
                  ? (lot.assignedSpaces / lot.totalSpaces) * 100
                  : 0;
                return (
                  <Card key={lot.id} className="border-border">
                    <CardHeader className="pb-2">
                      <button
                        onClick={() => toggleLot(lot.id)}
                        className="flex w-full items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <CardTitle className="text-base">{lot.name}</CardTitle>
                          <Badge variant="outline" className="text-[10px]">
                            {lot.type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {lot.property.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-semibold">
                              {lot.assignedSpaces} / {lot.totalSpaces}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {Math.round(occupancyPct)}% full
                            </p>
                          </div>
                          <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{ width: `${occupancyPct}%` }}
                            />
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold">{fmt(lot.monthlyRevenue)}</p>
                            <p className="text-[10px] text-muted-foreground">/mo</p>
                          </div>
                        </div>
                      </button>
                    </CardHeader>
                    {isExpanded && (
                      <CardContent className="space-y-4">
                        {/* Layout Image */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-medium flex items-center gap-2">
                              <Map className="h-4 w-4 text-muted-foreground" />
                              Parking Layout Map
                            </label>
                            {lot.layoutImageUrl && (
                              <button
                                onClick={() => handleDeleteLayout(lot.id)}
                                className="text-xs text-red-500 hover:underline"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          {lot.layoutImageUrl ? (
                            <div className="relative rounded-lg border overflow-hidden bg-muted/30">
                              {lot.layoutImageUrl.toLowerCase().endsWith(".pdf") ? (
                                <div className="flex items-center justify-between p-4">
                                  <div className="flex items-center gap-2 text-sm">
                                    <Map className="h-4 w-4 text-muted-foreground" />
                                    <span>Layout PDF uploaded</span>
                                  </div>
                                  <a
                                    href={lot.layoutImageUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                                  >
                                    Open PDF
                                  </a>
                                </div>
                              ) : (
                                <>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={lot.layoutImageUrl}
                                    alt={`Layout map for ${lot.name}`}
                                    className="w-full h-auto max-h-[400px] object-contain cursor-pointer"
                                    onClick={() => setExpandedImage(lot.layoutImageUrl)}
                                  />
                                  <div className="absolute bottom-2 right-2">
                                    <button
                                      onClick={() =>
                                        setExpandedImage(lot.layoutImageUrl)
                                      }
                                      className="rounded-lg bg-background/90 backdrop-blur px-2 py-1 text-xs font-medium border shadow-sm hover:bg-background flex items-center gap-1"
                                    >
                                      <Maximize2 className="h-3 w-3" />
                                      Expand
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed bg-muted/30 p-6 cursor-pointer hover:bg-muted/50 transition-colors">
                              {uploadingLayoutLotId === lot.id ? (
                                <>
                                  <Loader2 className="h-8 w-8 text-muted-foreground mb-2 animate-spin" />
                                  <span className="text-sm font-medium">
                                    Uploading...
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                                  <span className="text-sm font-medium">
                                    Upload Layout Map
                                  </span>
                                  <span className="text-xs text-muted-foreground mt-1">
                                    JPG, PNG, WebP, or PDF &mdash; max 10MB
                                  </span>
                                </>
                              )}
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,application/pdf"
                                onChange={(e) => handleLayoutUpload(e, lot.id)}
                                className="hidden"
                                disabled={uploadingLayoutLotId === lot.id}
                              />
                            </label>
                          )}
                        </div>

                        {/* Spaces table */}
                        {!lotSpaces[lot.id] ? (
                          <div className="py-6 text-center">
                            <Loader2 className="inline h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        ) : (
                          <div className="rounded-lg border overflow-hidden">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/50">
                                <tr>
                                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">
                                    Space
                                  </th>
                                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">
                                    Type
                                  </th>
                                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">
                                    Rate
                                  </th>
                                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">
                                    Assignment
                                  </th>
                                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">
                                    Action
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {lotSpaces[lot.id].map((space) => {
                                  const assignment = space.assignments?.[0];
                                  return (
                                    <tr key={space.id} className="border-t">
                                      <td className="px-3 py-2 font-medium">
                                        {space.number}
                                      </td>
                                      <td className="px-3 py-2 text-xs text-muted-foreground">
                                        {space.type.replace(/_/g, " ")}
                                      </td>
                                      <td className="px-3 py-2 text-right text-xs">
                                        {space.monthlyRate > 0 ? fmt(space.monthlyRate) : "\u2014"}
                                      </td>
                                      <td className="px-3 py-2">
                                        {assignment ? (
                                          <div className="text-xs">
                                            <p className="font-medium">
                                              {assignment.tenant?.user?.name || "\u2014"}
                                            </p>
                                            {assignment.vehicleMake && (
                                              <p className="text-muted-foreground">
                                                {assignment.vehicleMake} {assignment.vehicleModel}
                                                {assignment.licensePlate && ` \u00b7 ${assignment.licensePlate}`}
                                              </p>
                                            )}
                                          </div>
                                        ) : (
                                          <span className="text-xs text-green-600">Available</span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2 text-right">
                                        {assignment ? (
                                          <button
                                            onClick={() => revokeAssignment(assignment.id, lot.id)}
                                            className="text-xs text-red-500 hover:underline"
                                          >
                                            Revoke
                                          </button>
                                        ) : (
                                          <button
                                            onClick={() => openAssign(space, lot.id)}
                                            className="text-xs text-primary hover:underline"
                                          >
                                            Assign
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Lot Dialog */}
      <Dialog open={showAddLot} onOpenChange={setShowAddLot}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Parking Lot</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Property *</Label>
              <select
                value={lotPropertyId}
                onChange={(e) => setLotPropertyId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select property</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Lot Name *</Label>
              <Input
                value={lotName}
                onChange={(e) => setLotName(e.target.value)}
                placeholder="e.g. Main Lot, Underground Garage"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <select
                value={lotType}
                onChange={(e) => setLotType(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="SURFACE">Surface Lot</option>
                <option value="GARAGE">Garage</option>
                <option value="UNDERGROUND">Underground</option>
                <option value="COVERED">Covered</option>
                <option value="STREET">Street Parking</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Total Spaces</Label>
                <Input
                  type="number"
                  min="1"
                  value={lotTotalSpaces}
                  onChange={(e) => setLotTotalSpaces(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Default Rate / mo</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={lotDefaultRate}
                  onChange={(e) => setLotDefaultRate(Number(e.target.value))}
                  placeholder="0 = included"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddLot(false)}>
                Cancel
              </Button>
              <Button onClick={createLot} disabled={creatingLot}>
                {creatingLot ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : null}
                Create & Generate Spaces
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Space Dialog */}
      <Dialog open={!!assignSpace} onOpenChange={(open) => !open && setAssignSpace(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Assign Space {assignSpace?.number}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Unit</Label>
              <select
                value={assignUnitId}
                onChange={(e) => {
                  setAssignUnitId(e.target.value);
                  const unit = units.find((u) => u.id === e.target.value);
                  if (unit?.tenantProfiles?.[0]) {
                    setAssignTenantId(unit.tenantProfiles[0].id);
                  }
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select unit (optional)</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    Unit {u.unitNumber}
                    {u.tenantProfiles?.[0]?.user?.name &&
                      ` — ${u.tenantProfiles[0].user.name}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Vehicle Make</Label>
                <Input
                  value={assignVehicleMake}
                  onChange={(e) => setAssignVehicleMake(e.target.value)}
                  placeholder="Toyota"
                />
              </div>
              <div className="space-y-2">
                <Label>Model</Label>
                <Input
                  value={assignVehicleModel}
                  onChange={(e) => setAssignVehicleModel(e.target.value)}
                  placeholder="Camry"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>License Plate</Label>
              <Input
                value={assignLicensePlate}
                onChange={(e) => setAssignLicensePlate(e.target.value)}
                placeholder="ABC-1234"
              />
            </div>
            <div className="space-y-2">
              <Label>Pricing</Label>
              <div className="flex gap-2">
                <button
                  onClick={() => setAssignIsIncluded(true)}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-sm font-medium",
                    assignIsIncluded && "bg-primary text-primary-foreground border-primary"
                  )}
                >
                  Included with Lease
                </button>
                <button
                  onClick={() => setAssignIsIncluded(false)}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-sm font-medium",
                    !assignIsIncluded && "bg-primary text-primary-foreground border-primary"
                  )}
                >
                  Extra Charge
                </button>
              </div>
              {!assignIsIncluded && (
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={assignMonthlyCharge}
                  onChange={(e) => setAssignMonthlyCharge(Number(e.target.value))}
                  placeholder="Monthly charge"
                />
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAssignSpace(null)}>
                Cancel
              </Button>
              <Button onClick={saveAssignment} disabled={assigning}>
                {assigning ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : null}
                Assign Space
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Full-screen image viewer */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setExpandedImage(null)}
        >
          <div
            className="relative max-w-6xl max-h-[90vh] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={expandedImage}
              alt="Parking layout"
              className="w-full h-full object-contain rounded-lg"
            />
            <button
              onClick={() => setExpandedImage(null)}
              className="absolute top-2 right-2 rounded-full bg-background/90 p-2 hover:bg-background shadow-lg"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

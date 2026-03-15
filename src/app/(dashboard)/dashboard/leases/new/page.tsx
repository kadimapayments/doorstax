"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "sonner";

interface PropertyWithUnits {
  id: string;
  name: string;
  units: { id: string; unitNumber: string; rentAmount: string | number }[];
}

interface TenantItem {
  tenantId: string;
  userId: string;
  name: string;
  email: string;
  unitId: string;
}

export default function NewLeasePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState<PropertyWithUnits[]>([]);
  const [tenants, setTenants] = useState<TenantItem[]>([]);

  const [selectedProperty, setSelectedProperty] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");
  const [selectedTenant, setSelectedTenant] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rentAmount, setRentAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  const prefillUnitId = searchParams.get("unitId") || "";
  const prefillTenantId = searchParams.get("tenantId") || "";

  useEffect(() => {
    fetch("/api/properties")
      .then((r) => r.json())
      .then((data: PropertyWithUnits[]) => {
        setProperties(data);
        // Auto-select property and unit if unitId is pre-filled
        if (prefillUnitId && !prefilled) {
          for (const p of data) {
            const matchingUnit = p.units.find((u) => u.id === prefillUnitId);
            if (matchingUnit) {
              setSelectedProperty(p.id);
              setSelectedUnit(matchingUnit.id);
              setRentAmount(String(Number(matchingUnit.rentAmount)));
              setPrefilled(true);
              break;
            }
          }
        }
      });
  }, [prefillUnitId, prefilled]);

  useEffect(() => {
    if (!selectedUnit) {
      setTenants([]);
      setSelectedTenant("");
      return;
    }
    fetch(`/api/tenants?unitId=${selectedUnit}`)
      .then((r) => r.json())
      .then((data: TenantItem[]) => {
        setTenants(data);
        // Auto-select tenant from URL param or if there's only one
        if (prefillTenantId) {
          const match = data.find((t) => t.tenantId === prefillTenantId);
          if (match) {
            setSelectedTenant(match.tenantId);
            return;
          }
        }
        if (data.length === 1) setSelectedTenant(data[0].tenantId);
      });
  }, [selectedUnit, prefillTenantId]);

  const units =
    properties.find((p) => p.id === selectedProperty)?.units || [];

  function handleUnitChange(unitId: string) {
    setSelectedUnit(unitId);
    setSelectedTenant("");
    // Pre-populate rent amount from unit
    const unit = units.find((u) => u.id === unitId);
    if (unit) {
      setRentAmount(String(Number(unit.rentAmount)));
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "leases");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) {
        setDocumentUrl(data.url);
        toast.success("Document uploaded");
      } else {
        toast.error(data.error || "Upload failed");
      }
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedProperty || !selectedUnit || !selectedTenant) {
      toast.error("Please select a property, unit, and tenant");
      return;
    }
    if (!startDate || !endDate || !rentAmount) {
      toast.error("Start date, end date, and rent amount are required");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/leases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: selectedProperty,
          unitId: selectedUnit,
          tenantId: selectedTenant,
          startDate,
          endDate,
          rentAmount: Number(rentAmount),
          notes: notes || undefined,
          documentUrl: documentUrl || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to create lease");
        setLoading(false);
        return;
      }

      toast.success("Lease created!");
      router.push("/dashboard/leases");
    } catch {
      toast.error("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Lease"
        description="Create a new lease agreement for a tenant."
      />

      <Card className="max-w-lg border-border">
        <CardHeader>
          <CardTitle>Lease Details</CardTitle>
          <CardDescription>
            Select the property, unit, and tenant, then set the lease terms.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Property */}
            <div className="space-y-2">
              <Label>Property</Label>
              <Select
                value={selectedProperty}
                onValueChange={(v) => {
                  setSelectedProperty(v);
                  setSelectedUnit("");
                  setSelectedTenant("");
                  setTenants([]);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Unit */}
            {selectedProperty && (
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select
                  value={selectedUnit}
                  onValueChange={handleUnitChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        Unit {u.unitNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Tenant */}
            {tenants.length > 0 && (
              <div className="space-y-2">
                <Label>Tenant</Label>
                <Select
                  value={selectedTenant}
                  onValueChange={setSelectedTenant}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map((t) => (
                      <SelectItem key={t.tenantId} value={t.tenantId}>
                        {t.name} ({t.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Rent Amount */}
            <div className="space-y-2">
              <Label htmlFor="rentAmount">Monthly Rent ($)</Label>
              <Input
                id="rentAmount"
                type="number"
                step="0.01"
                min="0"
                value={rentAmount}
                onChange={(e) => setRentAmount(e.target.value)}
                required
                placeholder="e.g. 1500"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            {/* Document Upload */}
            <div className="space-y-2">
              <Label>Lease Document (optional)</Label>
              <Input
                type="file"
                accept="application/pdf,image/*"
                onChange={handleFileUpload}
                disabled={uploading}
              />
              {uploading && (
                <p className="text-xs text-muted-foreground">Uploading...</p>
              )}
              {documentUrl && (
                <p className="text-xs text-emerald-500">Document uploaded ✓</p>
              )}
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Lease"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

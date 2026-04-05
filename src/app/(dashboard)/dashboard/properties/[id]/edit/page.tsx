// Force rebuild: fee schedule dropdown v2
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ImageUpload } from "@/components/ui/image-upload";

interface PropertyData {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  propertyType: string;
  description: string | null;
  photos: string[];
  purchasePrice: string | number | null;
  purchaseDate: string | null;
  feeScheduleId: string | null;
}

interface FeeScheduleOption {
  id: string;
  name: string;
  achRate: number;
  managementFeePercent: number;
  achFeeResponsibility: string;
}

export default function EditPropertyPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const propertyId = params.id;

  const [property, setProperty] = useState<PropertyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [feeSchedules, setFeeSchedules] = useState<FeeScheduleOption[]>([]);
  const [selectedFeeScheduleId, setSelectedFeeScheduleId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProperty() {
      try {
        const res = await fetch(`/api/properties/${propertyId}`);
        if (!res.ok) {
          toast.error("Failed to load property");
          router.push("/dashboard/properties");
          return;
        }
        const data = await res.json();
        setProperty(data);
        setPhotos(data.photos || []);
        setSelectedFeeScheduleId(data.feeScheduleId || null);
      } catch {
        toast.error("Something went wrong");
        router.push("/dashboard/properties");
      } finally {
        setLoading(false);
      }
    }
    async function fetchFeeSchedules() {
      try {
        const res = await fetch("/api/fee-schedules");
        if (res.ok) {
          const data = await res.json();
          setFeeSchedules(
            (data || []).map((s: any) => ({
              id: s.id,
              name: s.name,
              achRate: Number(s.achRate),
              managementFeePercent: Number(s.managementFeePercent),
              achFeeResponsibility: s.achFeeResponsibility || "OWNER",
            }))
          );
        }
      } catch { /* ignore */ }
    }
    fetchProperty();
    fetchFeeSchedules();
  }, [propertyId, router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      name: formData.get("name"),
      address: formData.get("address"),
      city: formData.get("city"),
      state: formData.get("state"),
      zip: formData.get("zip"),
      propertyType: formData.get("propertyType") || "MULTIFAMILY",
      description: formData.get("description") || undefined,
      photos,
      purchasePrice: formData.get("purchasePrice") ? Number(formData.get("purchasePrice")) : undefined,
      purchaseDate: formData.get("purchaseDate") || undefined,
      feeScheduleId: selectedFeeScheduleId || null,
    };

    try {
      const res = await fetch(`/api/properties/${propertyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to update property");
        setSaving(false);
        return;
      }

      toast.success("Property updated");
      router.push(`/dashboard/properties/${propertyId}`);
    } catch {
      toast.error("Something went wrong");
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit Property" />
        <Card className="max-w-2xl border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              Loading property...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!property) return null;

  return (
    <div className="space-y-6">
      <Link
        href={`/dashboard/properties/${propertyId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Property
      </Link>

      <PageHeader title="Edit Property" />

      <Card className="max-w-2xl border-border">
        <CardHeader>
          <CardTitle>Property Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Property Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g. Sunset Apartments"
                defaultValue={property.name}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Street Address</Label>
              <Input
                id="address"
                name="address"
                placeholder="123 Main St"
                defaultValue={property.address}
                required
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  name="city"
                  placeholder="City"
                  defaultValue={property.city}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  name="state"
                  placeholder="CA"
                  maxLength={2}
                  defaultValue={property.state}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip">ZIP Code</Label>
                <Input
                  id="zip"
                  name="zip"
                  placeholder="90210"
                  defaultValue={property.zip}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="propertyType">Property Type</Label>
              <select
                id="propertyType"
                name="propertyType"
                defaultValue={property.propertyType}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="SINGLE_FAMILY">Single Family</option>
                <option value="MULTIFAMILY">Multifamily</option>
                <option value="OFFICE">Office</option>
                <option value="COMMERCIAL">Commercial</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                name="description"
                placeholder="Brief description..."
                defaultValue={property.description || ""}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="purchasePrice">Purchase Price (optional)</Label>
                <Input
                  id="purchasePrice"
                  name="purchasePrice"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 500000"
                  defaultValue={property.purchasePrice ? Number(property.purchasePrice) : ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchaseDate">Purchase Date (optional)</Label>
                <Input
                  id="purchaseDate"
                  name="purchaseDate"
                  type="date"
                  defaultValue={property.purchaseDate ? property.purchaseDate.split("T")[0] : ""}
                />
              </div>
            </div>
            {feeSchedules.length > 0 && (
              <div className="space-y-2">
                <Label>Fee Schedule</Label>
                <select
                  value={selectedFeeScheduleId || ""}
                  onChange={(e) => setSelectedFeeScheduleId(e.target.value || null)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">— Use owner default —</option>
                  {feeSchedules.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (ACH: ${s.achRate}, Mgmt: {s.managementFeePercent}%)
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Override the owner&apos;s fee schedule for this specific property.
                </p>
              </div>
            )}
            <ImageUpload
              images={photos}
              onChange={setPhotos}
              folder="properties"
            />
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
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

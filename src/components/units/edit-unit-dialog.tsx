"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Pencil, AlertTriangle } from "lucide-react";
import { ImageUpload } from "@/components/ui/image-upload";

interface EditUnitDialogProps {
  propertyId: string;
  unit: {
    id: string;
    unitNumber: string;
    bedrooms: number | null;
    bathrooms: number | null;
    sqft: number | null;
    parkingSpaces: number | null;
    rentAmount: number | string;
    dueDay: number;
    description: string | null;
    photos: string[];
  };
}

export function EditUnitDialog({ propertyId, unit }: EditUnitDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<string[]>(unit.photos || []);

  // Fetch active-lease presence on open. When present, a warning is
  // rendered below the rent input nudging the PM toward the lease-level
  // Adjust Rent flow (which writes RentChangeHistory + notifies tenant).
  // Direct edits still work — they just auto-sync to the lease in the
  // PUT handler with complianceAck=false so the drift is flagged.
  const [activeLeaseId, setActiveLeaseId] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/leases?unitId=${unit.id}`);
        if (!res.ok) return;
        const data = await res.json();
        const leases = Array.isArray(data) ? data : data?.leases || [];
        const active = leases.find(
          (l: { status: string }) =>
            l.status === "ACTIVE" || l.status === "MONTH_TO_MONTH"
        );
        if (!cancelled) setActiveLeaseId(active?.id ?? null);
      } catch {
        // silent — guardrail is an advisory, not a blocker
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, unit.id]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      unitNumber: formData.get("unitNumber"),
      bedrooms: formData.get("bedrooms") || undefined,
      bathrooms: formData.get("bathrooms") || undefined,
      sqft: formData.get("sqft") || undefined,
      parkingSpaces: formData.get("parkingSpaces") || undefined,
      rentAmount: formData.get("rentAmount"),
      dueDay: formData.get("dueDay") || 1,
      description: formData.get("description") || undefined,
      photos,
    };

    try {
      const res = await fetch(
        `/api/properties/${propertyId}/units/${unit.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to update unit");
        setLoading(false);
        return;
      }

      toast.success("Unit updated");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="mr-2 h-4 w-4" />
          Edit Unit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Unit {unit.unitNumber}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-unitNumber">Unit Number</Label>
              <Input
                id="edit-unitNumber"
                name="unitNumber"
                defaultValue={unit.unitNumber}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-rentAmount">Monthly Rent ($)</Label>
              <Input
                id="edit-rentAmount"
                name="rentAmount"
                type="number"
                step="0.01"
                min="0"
                defaultValue={Number(unit.rentAmount)}
                required
              />
              {activeLeaseId && (
                <p className="text-[11px] text-amber-600 flex items-start gap-1 mt-1">
                  <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>
                    This is the market / listing rent. For a tenant&apos;s
                    actual billed rent, use <b>Adjust Rent</b> on their
                    active lease — it adds a compliance audit trail and
                    emails the tenant a notice.
                  </span>
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-bedrooms">Bedrooms</Label>
              <Input
                id="edit-bedrooms"
                name="bedrooms"
                type="number"
                min="0"
                defaultValue={unit.bedrooms ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-bathrooms">Bathrooms</Label>
              <Input
                id="edit-bathrooms"
                name="bathrooms"
                type="number"
                step="0.5"
                min="0"
                defaultValue={unit.bathrooms ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-sqft">Sq Ft</Label>
              <Input
                id="edit-sqft"
                name="sqft"
                type="number"
                min="0"
                defaultValue={unit.sqft ?? ""}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-parkingSpaces">Parking Spaces</Label>
              <Input
                id="edit-parkingSpaces"
                name="parkingSpaces"
                type="number"
                min="0"
                defaultValue={unit.parkingSpaces ?? ""}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-dueDay">Rent Due Day (1-28)</Label>
              <Input
                id="edit-dueDay"
                name="dueDay"
                type="number"
                min="1"
                max="28"
                defaultValue={unit.dueDay}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-description">Description (optional)</Label>
            <Input
              id="edit-description"
              name="description"
              defaultValue={unit.description ?? ""}
              placeholder="Unit description..."
            />
          </div>
          <ImageUpload
            images={photos}
            onChange={setPhotos}
            folder="units"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
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
import { Pencil } from "lucide-react";

interface EditUnitDialogProps {
  propertyId: string;
  unit: {
    id: string;
    unitNumber: string;
    bedrooms: number | null;
    bathrooms: number | null;
    sqft: number | null;
    rentAmount: number | string;
    dueDay: number;
    description: string | null;
  };
}

export function EditUnitDialog({ propertyId, unit }: EditUnitDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      unitNumber: formData.get("unitNumber"),
      bedrooms: formData.get("bedrooms") || undefined,
      bathrooms: formData.get("bathrooms") || undefined,
      sqft: formData.get("sqft") || undefined,
      rentAmount: formData.get("rentAmount"),
      dueDay: formData.get("dueDay") || 1,
      description: formData.get("description") || undefined,
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
          <div className="space-y-2">
            <Label htmlFor="edit-description">Description (optional)</Label>
            <Input
              id="edit-description"
              name="description"
              defaultValue={unit.description ?? ""}
              placeholder="Unit description..."
            />
          </div>
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

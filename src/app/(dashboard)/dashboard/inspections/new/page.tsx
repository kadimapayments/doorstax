"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function NewInspectionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/properties").then((r) => r.json()).then(setProperties);
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/inspections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId: fd.get("propertyId"),
        type: fd.get("type"),
        scheduledAt: fd.get("scheduledAt") || null,
        notes: fd.get("notes") || null,
      }),
    });
    if (res.ok) {
      toast.success("Inspection scheduled");
      router.push("/dashboard/inspections");
    } else {
      toast.error("Failed to schedule inspection");
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader title="New Inspection" description="Schedule a property inspection." />
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="propertyId">Property *</Label>
          <select name="propertyId" id="propertyId" required className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
            <option value="">Select property...</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="type">Inspection Type *</Label>
          <select name="type" id="type" required className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
            <option value="MOVE_IN">Move-In</option>
            <option value="MOVE_OUT">Move-Out</option>
            <option value="ROUTINE">Routine</option>
            <option value="INITIAL">Initial</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="scheduledAt">Scheduled Date</Label>
          <Input type="date" name="scheduledAt" id="scheduledAt" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <textarea name="notes" id="notes" rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Scheduling..." : "Schedule Inspection"}
        </Button>
      </form>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  units: { id: string; unitNumber: string; status: string }[];
}

export default function AddTenantPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState<PropertyWithUnits[]>([]);
  const [selectedProperty, setSelectedProperty] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");

  useEffect(() => {
    fetch("/api/properties")
      .then((r) => r.json())
      .then(setProperties);
  }, []);

  const units =
    properties.find((p) => p.id === selectedProperty)?.units || [];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const fd = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/tenants/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.get("name"),
          email: fd.get("email"),
          phone: fd.get("phone") || undefined,
          unitId: selectedUnit,
          leaseStart: fd.get("leaseStart") || undefined,
          leaseEnd: fd.get("leaseEnd") || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to create tenant");
        setLoading(false);
        return;
      }

      toast.success("Tenant created! An invite link has been sent for password setup.");
      if (data.inviteUrl) {
        toast.info(`Dev invite link: ${data.inviteUrl}`, { duration: 15000 });
      }
      router.push("/dashboard/tenants");
    } catch {
      toast.error("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Add Tenant" description="Create a tenant and assign them to a unit immediately." />

      <Card className="max-w-lg border-border">
        <CardHeader>
          <CardTitle>Tenant Details</CardTitle>
          <CardDescription>
            The tenant will receive an invite link to set up their password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input id="phone" name="phone" type="tel" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>

            <div className="space-y-2">
              <Label>Property</Label>
              <Select
                value={selectedProperty}
                onValueChange={(v) => {
                  setSelectedProperty(v);
                  setSelectedUnit("");
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

            {selectedProperty && (
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.length === 0 ? (
                      <SelectItem value="_none" disabled>
                        No units
                      </SelectItem>
                    ) : (
                      units.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          Unit {u.unitNumber} ({u.status === "AVAILABLE" ? "Available" : "Occupied"})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="leaseStart">Lease Start (optional)</Label>
                <Input id="leaseStart" name="leaseStart" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="leaseEnd">Lease End (optional)</Label>
                <Input id="leaseEnd" name="leaseEnd" type="date" />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading || !selectedUnit}>
                {loading ? "Creating..." : "Create Tenant"}
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

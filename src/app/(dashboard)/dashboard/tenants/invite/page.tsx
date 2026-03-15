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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { LineItemsForm, type LineItem } from "@/components/tenants/line-items-form";
import { toast } from "sonner";

interface PropertyWithUnits {
  id: string;
  name: string;
  units: { id: string; unitNumber: string; status: string; rentAmount?: number }[];
}

export default function InviteTenantPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState<PropertyWithUnits[]>([]);
  const [selectedProperty, setSelectedProperty] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  useEffect(() => {
    fetch("/api/properties")
      .then((r) => r.json())
      .then(setProperties);
  }, []);

  const availableUnits =
    properties
      .find((p) => p.id === selectedProperty)
      ?.units.filter((u) => u.status === "AVAILABLE") || [];
  const selectedUnitData = availableUnits.find((u) => u.id === selectedUnit);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/tenants/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          unitId: selectedUnit,
          ...(lineItems.length > 0 ? { lineItems } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to send invite");
        setLoading(false);
        return;
      }

      toast.success("Invitation sent!");
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
      <PageHeader title="Invite Tenant" />

      <Card className="max-w-lg border-border">
        <CardHeader>
          <CardTitle>Send Invitation</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="John Smith"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="tenant@example.com"
                required
              />
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
                    <SelectValue placeholder="Select available unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUnits.length === 0 ? (
                      <SelectItem value="_none" disabled>
                        No available units
                      </SelectItem>
                    ) : (
                      availableUnits.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          Unit {u.unitNumber}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            <LineItemsForm
              items={lineItems}
              onChange={setLineItems}
              defaultRentAmount={selectedUnitData?.rentAmount ? Number(selectedUnitData.rentAmount) : undefined}
            />

            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                disabled={loading || !selectedUnit}
              >
                {loading ? "Sending..." : "Send Invitation"}
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

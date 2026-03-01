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
import { ImagePlus } from "lucide-react";
import Image from "next/image";

interface PropertyWithUnits {
  id: string;
  name: string;
  units: { id: string; unitNumber: string }[];
}

interface TenantItem {
  tenantId: string;
  name: string;
  email: string;
}

const CATEGORIES = [
  "MAINTENANCE",
  "PLUMBING",
  "ELECTRICAL",
  "HVAC",
  "PEST_CONTROL",
  "GENERAL",
  "OTHER",
];

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export default function LandlordCreateTicketPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState<PropertyWithUnits[]>([]);
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [selectedProperty, setSelectedProperty] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");
  const [selectedTenant, setSelectedTenant] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch("/api/properties")
      .then((r) => r.json())
      .then(setProperties);
  }, []);

  // Load tenants when unit is selected
  useEffect(() => {
    if (!selectedUnit) {
      setTenants([]);
      setSelectedTenant("");
      return;
    }
    fetch(`/api/tenants?unitId=${selectedUnit}`)
      .then((r) => r.json())
      .then((data) => {
        setTenants(data);
        if (data.length === 1) setSelectedTenant(data[0].tenantId);
      });
  }, [selectedUnit]);

  const units = properties.find((p) => p.id === selectedProperty)?.units || [];

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        setImages((prev) => [...prev, data.url]);
      } else {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    setUploading(false);
    e.target.value = "";
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedTenant || !selectedUnit) {
      toast.error("Please select a property, unit, and tenant");
      return;
    }
    setLoading(true);

    const fd = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: fd.get("title"),
          description: fd.get("description"),
          category: fd.get("category"),
          priority: fd.get("priority"),
          tenantId: selectedTenant,
          unitId: selectedUnit,
          images,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to create ticket");
        setLoading(false);
        return;
      }

      toast.success("Ticket created!");
      router.push("/dashboard/tickets");
    } catch {
      toast.error("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Create Ticket" description="Create a service ticket on behalf of a tenant." />

      <Card className="max-w-lg border-border">
        <CardHeader>
          <CardTitle>Ticket Details</CardTitle>
          <CardDescription>Select the property, unit, and tenant, then describe the issue.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Property</Label>
              <Select value={selectedProperty} onValueChange={(v) => { setSelectedProperty(v); setSelectedUnit(""); }}>
                <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedProperty && (
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                  <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={u.id}>Unit {u.unitNumber}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {tenants.length > 1 && (
              <div className="space-y-2">
                <Label>Tenant</Label>
                <Select value={selectedTenant} onValueChange={setSelectedTenant}>
                  <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
                  <SelectContent>
                    {tenants.map((t) => (
                      <SelectItem key={t.tenantId} value={t.tenantId}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                name="description"
                required
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select name="category" defaultValue="GENERAL">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select name="priority" defaultValue="MEDIUM">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Image upload */}
            <div className="space-y-2">
              <Label>Images (optional)</Label>
              {images.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {images.map((img, i) => (
                    <div key={i} className="relative">
                      <Image src={img} alt={`Upload ${i + 1}`} width={60} height={60} className="rounded border border-border object-cover" />
                      <button
                        type="button"
                        onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                        className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-white text-xs flex items-center justify-center"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="cursor-pointer">
                <input type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" />
                <Button type="button" variant="outline" size="sm" asChild disabled={uploading}>
                  <span>
                    <ImagePlus className="mr-1 h-3 w-3" />
                    {uploading ? "Uploading..." : "Add Images"}
                  </span>
                </Button>
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading || !selectedTenant}>
                {loading ? "Creating..." : "Create Ticket"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

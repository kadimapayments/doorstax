"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Pencil, X, Save } from "lucide-react";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  "PLUMBING", "ELECTRICAL", "HVAC", "GENERAL", "ROOFING",
  "LANDSCAPING", "CLEANING", "PEST_CONTROL", "PAINTING",
  "APPLIANCE", "LOCKSMITH", "OTHER",
];

interface VendorData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  category: string;
  notes: string | null;
  rating: number | null;
  isActive: boolean;
}

export function VendorEditButton({ vendor }: { vendor: VendorData }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: vendor.name,
    email: vendor.email || "",
    phone: vendor.phone || "",
    company: vendor.company || "",
    category: vendor.category,
    notes: vendor.notes || "",
    rating: vendor.rating ? String(vendor.rating) : "",
    isActive: vendor.isActive,
  });

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/vendors/${vendor.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email || null,
          phone: form.phone || null,
          company: form.company || null,
          category: form.category,
          notes: form.notes || null,
          rating: form.rating ? Number(form.rating) : null,
          isActive: form.isActive,
        }),
      });
      if (res.ok) {
        toast.success("Vendor updated");
        setEditing(false);
        router.refresh();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to update");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
        <Pencil className="mr-1.5 h-3.5 w-3.5" />
        Edit Vendor
      </Button>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Edit Vendor</h3>
        <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Name *</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Company</Label>
          <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Email</Label>
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Phone</Label>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Category</Label>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Rating (1-5)</Label>
          <Input type="number" min="1" max="5" step="0.1" value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} className="h-8 text-sm" />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Notes</Label>
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" />
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="isActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
        <label htmlFor="isActive" className="text-xs">Active vendor</label>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving || !form.name.trim()}>
          <Save className="mr-1 h-3 w-3" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const CATEGORIES = [
  "PLUMBING", "ELECTRICAL", "HVAC", "GENERAL", "ROOFING",
  "LANDSCAPING", "CLEANING", "PEST_CONTROL", "PAINTING", "OTHER",
];

export default function AddVendorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        email: fd.get("email"),
        phone: fd.get("phone"),
        company: fd.get("company"),
        category: fd.get("category"),
        notes: fd.get("notes"),
      }),
    });
    if (res.ok) {
      toast.success("Vendor added");
      router.push("/dashboard/vendors");
    } else {
      toast.error("Failed to add vendor");
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader title="Add Vendor" description="Add a new service vendor or contractor." />
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input id="name" name="name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="company">Company</Label>
          <Input id="company" name="company" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <PhoneInput id="phone" name="phone" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <select name="category" id="category" className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <textarea name="notes" id="notes" rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Adding..." : "Add Vendor"}
        </Button>
      </form>
    </div>
  );
}

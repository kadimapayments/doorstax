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
  units: { id: string; unitNumber: string }[];
}

const CATEGORIES = [
  "SERVICES",
  "UPGRADES",
  "TAXES",
  "MORTGAGE",
  "INSURANCE",
  "MAINTENANCE",
  "PAYROLL",
  "OTHER",
];

export default function NewExpensePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState<PropertyWithUnits[]>([]);
  const [selectedProperty, setSelectedProperty] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [vendor, setVendor] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch("/api/properties")
      .then((r) => r.json())
      .then(setProperties);
  }, []);

  const units =
    properties.find((p) => p.id === selectedProperty)?.units || [];

  async function handleReceiptUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "receipts");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) {
        setReceiptUrl(data.url);
        toast.success("Receipt uploaded");
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

    if (!selectedProperty || !category || !amount || !date || !description) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: selectedProperty,
          unitId: selectedUnit || undefined,
          category,
          amount: Number(amount),
          date,
          description,
          vendor: vendor || undefined,
          recurring,
          receiptUrl: receiptUrl || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to add expense");
        setLoading(false);
        return;
      }

      toast.success("Expense added!");
      router.push("/dashboard/expenses");
    } catch {
      toast.error("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Expense"
        description="Record a new property expense."
      />

      <Card className="max-w-lg border-border">
        <CardHeader>
          <CardTitle>Expense Details</CardTitle>
          <CardDescription>
            Enter the details of this expense.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Property */}
            <div className="space-y-2">
              <Label>Property *</Label>
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

            {/* Unit (optional) */}
            {selectedProperty && units.length > 0 && (
              <div className="space-y-2">
                <Label>Unit (optional)</Label>
                <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                  <SelectTrigger>
                    <SelectValue placeholder="All / General" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">All / General</SelectItem>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        Unit {u.unitNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Category */}
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c.charAt(0) + c.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount + Date */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount ($) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                placeholder="What was this expense for?"
              />
            </div>

            {/* Vendor */}
            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor (optional)</Label>
              <Input
                id="vendor"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="Company or person paid"
              />
            </div>

            {/* Recurring */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="recurring"
                checked={recurring}
                onChange={(e) => setRecurring(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="recurring" className="text-sm font-normal">
                This is a recurring expense
              </Label>
            </div>

            {/* Receipt Upload */}
            <div className="space-y-2">
              <Label>Receipt (optional)</Label>
              <Input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleReceiptUpload}
                disabled={uploading}
              />
              {uploading && (
                <p className="text-xs text-muted-foreground">Uploading...</p>
              )}
              {receiptUrl && (
                <p className="text-xs text-emerald-500">Receipt uploaded ✓</p>
              )}
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Adding..." : "Add Expense"}
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

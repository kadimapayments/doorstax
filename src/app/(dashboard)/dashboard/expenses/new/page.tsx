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
import { cn } from "@/lib/utils";

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
  const [payableBy, setPayableBy] = useState("OWNER");
  const [selectedTenant, setSelectedTenant] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [splits, setSplits] = useState<Array<{ party: string; percent: number; tenantId?: string }>>([]);
  const [notes, setNotes] = useState("");
  const [tenants, setTenants] = useState<Array<{ id: string; name: string; unitNumber: string }>>([]);

  useEffect(() => {
    fetch("/api/properties")
      .then((r) => r.json())
      .then(setProperties);
  }, []);

  useEffect(() => {
    if (!selectedProperty) { setTenants([]); return; }
    fetch("/api/expenses/tenants?propertyId=" + selectedProperty)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setTenants(Array.isArray(data) ? data : []))
      .catch(() => setTenants([]));
  }, [selectedProperty]);

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

    if (payableBy === "TENANT" && !selectedTenant) {
      toast.error("Please select a tenant to assign this charge to");
      return;
    }

    if (payableBy === "SPLIT") {
      if (splits.length < 2) {
        toast.error("Split expenses require at least 2 parties");
        return;
      }
      const totalPct = splits.reduce((s, sp) => s + sp.percent, 0);
      if (totalPct !== 100) {
        toast.error(`Split percentages must equal 100% (currently ${totalPct}%)`);
        return;
      }
      const invalidTenantSplit = splits.find((s) => s.party === "TENANT" && !s.tenantId);
      if (invalidTenantSplit) {
        toast.error("Please select a tenant for each TENANT split");
        return;
      }
    }

    setLoading(true);

    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: selectedProperty,
          unitId: selectedUnit && selectedUnit !== "none" ? selectedUnit : undefined,
          category,
          amount: Number(amount),
          date,
          description,
          vendor: vendor || undefined,
          recurring,
          receiptUrl: receiptUrl || undefined,
          payableBy,
          tenantId: payableBy === "TENANT" ? selectedTenant : undefined,
          dueDate: dueDate || undefined,
          splitConfig: payableBy === "SPLIT" ? splits.map((s) => ({
            ...s,
            amount: (Number(amount) * s.percent) / 100,
          })) : undefined,
          notes: notes || undefined,
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

            {/* Payable By */}
            <div className="space-y-2">
              <Label>Payable By</Label>
              <div className="flex flex-wrap gap-2">
                {["OWNER", "TENANT", "PM", "INSURANCE", "SPLIT"].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setPayableBy(option);
                      if (option !== "TENANT" && option !== "SPLIT") setSelectedTenant("");
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
                      payableBy === option
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:border-primary/30"
                    )}
                  >
                    {option === "PM" ? "I Pay (PM)" : option.charAt(0) + option.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {payableBy === "OWNER" && "Deducted from the owner's next payout."}
                {payableBy === "TENANT" && "Tenant will receive an invoice and can pay from their dashboard."}
                {payableBy === "PM" && "You absorb this cost. Tracked for your records."}
                {payableBy === "INSURANCE" && "Track this expense as an insurance claim."}
                {payableBy === "SPLIT" && "Split the cost between multiple parties."}
              </p>
            </div>

            {/* Tenant selector (when TENANT) */}
            {payableBy === "TENANT" && (
              <div className="space-y-3 rounded-lg border border-border p-3 bg-muted/30">
                <div className="space-y-2">
                  <Label>Assign to Tenant *</Label>
                  <select
                    value={selectedTenant}
                    onChange={(e) => setSelectedTenant(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    required
                  >
                    <option value="">Select tenant</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} {t.unitNumber ? `— Unit ${t.unitNumber}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </div>
            )}

            {/* Split config (when SPLIT) */}
            {payableBy === "SPLIT" && (
              <div className="space-y-3 rounded-lg border border-border p-3 bg-muted/30">
                <Label>Split Configuration</Label>
                {splits.length === 0 && (
                  <p className="text-xs text-muted-foreground">Add parties to split this expense.</p>
                )}
                {splits.map((split, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={split.party}
                      onChange={(e) => {
                        const s = [...splits];
                        s[idx].party = e.target.value;
                        if (e.target.value !== "TENANT") delete s[idx].tenantId;
                        setSplits(s);
                      }}
                      className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="OWNER">Owner</option>
                      <option value="TENANT">Tenant</option>
                      <option value="PM">PM</option>
                    </select>
                    {split.party === "TENANT" && (
                      <select
                        value={split.tenantId || ""}
                        onChange={(e) => {
                          const s = [...splits];
                          s[idx].tenantId = e.target.value;
                          setSplits(s);
                        }}
                        className="rounded-lg border border-input bg-background px-3 py-2 text-sm flex-1"
                      >
                        <option value="">Select tenant</option>
                        {tenants.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    )}
                    <Input
                      type="number"
                      value={split.percent}
                      onChange={(e) => {
                        const s = [...splits];
                        s[idx].percent = Number(e.target.value);
                        setSplits(s);
                      }}
                      className="w-20"
                      placeholder="%"
                      min={1}
                      max={100}
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                    <button
                      type="button"
                      onClick={() => setSplits(splits.filter((_, i) => i !== idx))}
                      className="text-destructive text-sm"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setSplits([...splits, { party: "OWNER", percent: 50 }])}
                  className="text-sm text-primary hover:underline"
                >
                  + Add party
                </button>
                {splits.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Total: {splits.reduce((s, sp) => s + sp.percent, 0)}%
                    {splits.reduce((s, sp) => s + sp.percent, 0) !== 100 && " (must equal 100%)"}
                  </p>
                )}
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
                placeholder="Internal notes about this expense..."
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

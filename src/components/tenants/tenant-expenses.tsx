"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import Link from "next/link";

interface ExpenseItem {
  id: string;
  description: string;
  amount: number;
  date: string;
  status: string;
  payableBy: string;
  category: string;
}

interface Props {
  tenantId: string;
  propertyId: string;
  unitId: string;
  expenses: ExpenseItem[];
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function TenantExpenses({ tenantId, propertyId, unitId, expenses }: Props) {
  const [items, setItems] = useState(expenses);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("SERVICES");
  const [saving, setSaving] = useState(false);

  async function handleQuickAdd() {
    if (!description || !amount) {
      toast.error("Description and amount required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          unitId,
          category,
          amount: Number(amount),
          date: new Date().toISOString(),
          description,
          payableBy: "TENANT",
          tenantId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setItems((prev) => [
          { id: data.id, description, amount: Number(amount), date: new Date().toISOString(), status: "INVOICED", payableBy: "TENANT", category },
          ...prev,
        ]);
        setDescription("");
        setAmount("");
        setShowQuickAdd(false);
        toast.success("Charge added and tenant notified");
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to add");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Charges & Expenses</CardTitle>
        <Button variant="outline" size="sm" onClick={() => setShowQuickAdd(!showQuickAdd)}>
          {showQuickAdd ? <X className="mr-1 h-3 w-3" /> : <Plus className="mr-1 h-3 w-3" />}
          {showQuickAdd ? "Cancel" : "Add Charge"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Quick add form */}
        {showQuickAdd && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Description *</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Parking fee" className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Amount ($) *</Label>
                <Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="h-8 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm">
                <option value="SERVICES">Services</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="UPGRADES">Upgrades</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <Button size="sm" onClick={handleQuickAdd} disabled={saving} className="w-full">
              {saving ? "Adding..." : "Add Charge to Tenant"}
            </Button>
            <p className="text-xs text-muted-foreground">This will create an invoice and notify the tenant by email.</p>
          </div>
        )}

        {/* Expenses list */}
        {items.length === 0 && !showQuickAdd ? (
          <p className="text-sm text-muted-foreground text-center py-4">No charges or expenses</p>
        ) : (
          <div className="space-y-1">
            {items.map((e) => (
              <div key={e.id} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                <div>
                  <span className="font-medium">{e.description}</span>
                  <span className="text-muted-foreground ml-2 text-xs">{fmtDate(e.date)}</span>
                  <span className="ml-2 text-xs capitalize text-muted-foreground">{e.category.toLowerCase()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded",
                    e.status === "PAID" ? "bg-emerald-500/10 text-emerald-500" :
                    e.status === "INVOICED" ? "bg-amber-500/10 text-amber-500" :
                    e.status === "WRITTEN_OFF" ? "bg-muted text-muted-foreground line-through" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {e.status === "WRITTEN_OFF" ? "Voided" : e.status?.charAt(0) + e.status?.slice(1).toLowerCase()}
                  </span>
                  <span className="font-medium">{formatMoney(e.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Link to full expenses page */}
        <Link href={`/dashboard/expenses?tenantId=${tenantId}`} className="text-xs text-primary hover:underline block text-center pt-1">
          View all in Expenses
        </Link>
      </CardContent>
    </Card>
  );
}

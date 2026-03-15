"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "sonner";
import { ArrowLeft, Search, User, Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TenantOption {
  tenantId: string;
  unitId: string;
  tenantName: string;
  propertyName: string;
  unitNumber: string;
  rentAmount: number;
}

export default function ChargeTenantPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("RENT");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/tenants")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data.tenants || [];
        // API returns flat: { tenantId, name, propertyName, unitNumber, rentAmount, unitId, ... }
        const options: TenantOption[] = list
          .filter((t: { unitId: string | null }) => t.unitId)
          .map(
            (t: {
              tenantId: string;
              unitId: string;
              name: string;
              propertyName: string;
              unitNumber: string;
              rentAmount: number;
            }) => ({
              tenantId: t.tenantId,
              unitId: t.unitId,
              tenantName: t.name,
              propertyName: t.propertyName,
              unitNumber: t.unitNumber,
              rentAmount: t.rentAmount,
            })
          );
        setTenants(options);
      });
  }, []);

  const filteredTenants = useMemo(() => {
    if (!search.trim()) return tenants;
    const q = search.toLowerCase();
    return tenants.filter(
      (t) =>
        t.tenantName.toLowerCase().includes(q) ||
        t.propertyName.toLowerCase().includes(q) ||
        t.unitNumber.toLowerCase().includes(q)
    );
  }, [tenants, search]);

  function handleTenantChange(value: string) {
    setSelectedTenant(value);
    const tenant = tenants.find((t) => t.tenantId === value);
    if (tenant) {
      setAmount(String(tenant.rentAmount));
    }
  }

  const selected = tenants.find((t) => t.tenantId === selectedTenant);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedTenant) {
      toast.error("Please select a tenant");
      return;
    }
    setLoading(true);

    if (!selected) return;

    const formData = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/payments/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: selected.tenantId,
          unitId: selected.unitId,
          amount: Number(amount),
          type,
          description: formData.get("description") || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to charge tenant");
        setLoading(false);
        return;
      }

      if (data.charged) {
        toast.success("Payment charged successfully");
      } else {
        toast.success(data.message || "Payment recorded");
      }
      router.push("/dashboard/payments");
    } catch {
      toast.error("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/payments"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Payments
      </Link>

      <PageHeader
        title="Charge Tenant"
        description="Create a charge for a tenant."
      />

      <Card className="max-w-2xl border-border">
        <CardHeader>
          <CardTitle className="text-base">Payment Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Tenant Search + Selection */}
            <div className="space-y-2">
              <Label>Tenant</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, property, or unit..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {filteredTenants.length === 0 && tenants.length > 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No tenants match &ldquo;{search}&rdquo;
                </p>
              ) : filteredTenants.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No tenants with assigned units found.
                </p>
              ) : (
                <div className="max-h-60 overflow-y-auto rounded-md border border-input divide-y divide-border">
                  {filteredTenants.map((t) => (
                    <button
                      key={t.tenantId}
                      type="button"
                      onClick={() => handleTenantChange(t.tenantId)}
                      className={`w-full text-left px-3 py-2.5 text-sm transition-colors hover:bg-muted/50 ${
                        selectedTenant === t.tenantId
                          ? "bg-primary/5 border-l-2 border-l-primary"
                          : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium">{t.tenantName}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          ${t.rentAmount.toFixed(2)}/mo
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground ml-5">
                        <Building2 className="h-3 w-3 shrink-0" />
                        {t.propertyName} — Unit {t.unitNumber}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected tenant info */}
            {selected && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                <span className="font-medium">{selected.tenantName}</span>
                <span className="text-muted-foreground">
                  {" "}— {selected.propertyName}, Unit {selected.unitNumber}
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount ($)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RENT">Rent</SelectItem>
                    <SelectItem value="DEPOSIT">Deposit</SelectItem>
                    <SelectItem value="FEE">Fee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                name="description"
                placeholder="e.g. March rent, late fee..."
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading || !selectedTenant}>
                {loading ? "Processing..." : "Charge Tenant"}
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

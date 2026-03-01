"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

interface TenantOption {
  tenantId: string;
  unitId: string;
  tenantName: string;
  propertyName: string;
  unitNumber: string;
  rentAmount: string;
}

export default function ChargeTenantPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("RENT");

  useEffect(() => {
    fetch("/api/tenants")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data.tenants || [];
        const options: TenantOption[] = list
          .filter((t: { unitId: string | null }) => t.unitId)
          .map(
            (t: {
              id: string;
              unitId: string;
              user: { name: string };
              unit: {
                unitNumber: string;
                rentAmount: string;
                property: { name: string };
              };
            }) => ({
              tenantId: t.id,
              unitId: t.unitId,
              tenantName: t.user.name,
              propertyName: t.unit.property.name,
              unitNumber: t.unit.unitNumber,
              rentAmount: t.unit.rentAmount,
            })
          );
        setTenants(options);
      });
  }, []);

  function handleTenantChange(value: string) {
    setSelectedTenant(value);
    const tenant = tenants.find((t) => t.tenantId === value);
    if (tenant) {
      setAmount(String(Number(tenant.rentAmount)));
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedTenant) {
      toast.error("Please select a tenant");
      return;
    }
    setLoading(true);

    const tenant = tenants.find((t) => t.tenantId === selectedTenant);
    if (!tenant) return;

    const formData = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/payments/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant.tenantId,
          unitId: tenant.unitId,
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
            <div className="space-y-2">
              <Label>Tenant</Label>
              <Select value={selectedTenant} onValueChange={handleTenantChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a tenant" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.tenantId} value={t.tenantId}>
                      {t.tenantName} — {t.propertyName}, Unit {t.unitNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
              <Button type="submit" disabled={loading}>
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

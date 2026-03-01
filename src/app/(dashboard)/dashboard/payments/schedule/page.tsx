"use client";

import { useEffect, useState } from "react";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { CalendarClock, Trash2 } from "lucide-react";

interface PropertyWithUnits {
  id: string;
  name: string;
  units: { id: string; unitNumber: string }[];
}

interface TenantItem {
  tenantId: string;
  name: string;
}

interface ScheduledItem {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  scheduledDate: string;
  executed: boolean;
  tenant: { user: { name: string } };
  unit: { unitNumber: string; property: { name: string } };
}

export default function SchedulePaymentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState<PropertyWithUnits[]>([]);
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledItem[]>([]);
  const [selectedProperty, setSelectedProperty] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");
  const [selectedTenant, setSelectedTenant] = useState("");

  useEffect(() => {
    fetch("/api/properties").then((r) => r.json()).then(setProperties);
    loadScheduled();
  }, []);

  useEffect(() => {
    if (!selectedUnit) { setTenants([]); setSelectedTenant(""); return; }
    fetch(`/api/tenants?unitId=${selectedUnit}`)
      .then((r) => r.json())
      .then((data) => {
        setTenants(data);
        if (data.length === 1) setSelectedTenant(data[0].tenantId);
      });
  }, [selectedUnit]);

  async function loadScheduled() {
    const res = await fetch("/api/payments/schedule");
    if (res.ok) {
      const data = await res.json();
      setScheduled(data);
    }
  }

  const units = properties.find((p) => p.id === selectedProperty)?.units || [];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedTenant || !selectedUnit) {
      toast.error("Select property, unit, and tenant");
      return;
    }
    setLoading(true);
    const fd = new FormData(e.currentTarget);

    const res = await fetch("/api/payments/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId: selectedTenant,
        unitId: selectedUnit,
        amount: Number(fd.get("amount")),
        type: fd.get("type"),
        description: fd.get("description") || undefined,
        scheduledDate: fd.get("scheduledDate"),
      }),
    });

    if (res.ok) {
      toast.success("Payment scheduled!");
      await loadScheduled();
      setLoading(false);
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to schedule");
      setLoading(false);
    }
  }

  async function handleCancel(id: string) {
    const res = await fetch(`/api/payments/schedule?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Scheduled payment cancelled");
      await loadScheduled();
    } else {
      toast.error("Failed to cancel");
    }
  }

  const columns: Column<ScheduledItem>[] = [
    {
      key: "tenant",
      header: "Tenant",
      cell: (row) => row.tenant.user.name,
    },
    {
      key: "property",
      header: "Property/Unit",
      cell: (row) => `${row.unit.property.name} #${row.unit.unitNumber}`,
    },
    {
      key: "amount",
      header: "Amount",
      cell: (row) => formatCurrency(Number(row.amount)),
    },
    {
      key: "type",
      header: "Type",
      cell: (row) => row.type,
    },
    {
      key: "date",
      header: "Scheduled For",
      cell: (row) => formatDate(new Date(row.scheduledDate)),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusBadge status={row.executed ? "COMPLETED" : "PENDING"} />,
    },
    {
      key: "actions",
      header: "",
      cell: (row) =>
        !row.executed && (
          <Button variant="ghost" size="sm" onClick={() => handleCancel(row.id)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Schedule Payment" description="Schedule future payments for tenants." />

      <Card className="max-w-lg border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            New Scheduled Payment
          </CardTitle>
          <CardDescription>The payment will be created on the scheduled date.</CardDescription>
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount ($)</Label>
                <Input id="amount" name="amount" type="number" step="0.01" min="0" required />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select name="type" defaultValue="RENT">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RENT">Rent</SelectItem>
                    <SelectItem value="DEPOSIT">Deposit</SelectItem>
                    <SelectItem value="FEE">Fee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduledDate">Scheduled Date</Label>
              <Input id="scheduledDate" name="scheduledDate" type="date" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input id="description" name="description" />
            </div>

            <Button type="submit" disabled={loading || !selectedTenant}>
              {loading ? "Scheduling..." : "Schedule Payment"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Upcoming scheduled payments */}
      {scheduled.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Scheduled Payments</h3>
          <DataTable columns={columns} data={scheduled} />
        </div>
      )}
    </div>
  );
}

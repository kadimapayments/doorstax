"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "sonner";
import { UserPlus, Percent, Trash2 } from "lucide-react";

interface TenantInfo {
  id: string;
  name: string;
  email: string;
  unitId: string;
  unitNumber: string;
  propertyName: string;
  rentAmount: number;
  splitPercent: number;
  isPrimary: boolean;
}

interface RoommateInfo {
  tenantId: string;
  name: string;
  email: string;
  percent: number;
  amount: number;
  isPrimary?: boolean;
}

interface RentSplitData {
  id: string;
  totalRent: number;
  splits: {
    tenantId: string;
    percent: number;
    amount: number;
    tenant: { id: string; user: { name: string; email: string } };
  }[];
}

export default function RoommatesPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [roommates, setRoommates] = useState<RoommateInfo[]>([]);
  const [rentSplit, setRentSplit] = useState<RentSplitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingRoommate, setAddingRoommate] = useState(false);
  const [splits, setSplits] = useState<{ tenantId: string; name: string; percent: number; isPrimary?: boolean }[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        // Fetch tenant info
        const tenantRes = await fetch(`/api/tenants/${params.id}`);
        if (!tenantRes.ok) {
          toast.error("Tenant not found");
          return;
        }
        const tenantData = await tenantRes.json();
        setTenant(tenantData);

        // Fetch all tenants in same unit (roommates)
        if (tenantData.unitId) {
          let roommatesData: RoommateInfo[] = [];
          const roommatesRes = await fetch(`/api/tenants?unitId=${tenantData.unitId}`);
          if (roommatesRes.ok) {
            roommatesData = await roommatesRes.json();
            setRoommates(roommatesData);

            // Initialize splits from current tenants
            setSplits(
              roommatesData.map((r: RoommateInfo) => ({
                tenantId: r.tenantId,
                name: r.name,
                percent: r.percent || Math.floor(100 / roommatesData.length),
                isPrimary: r.isPrimary,
              }))
            );
          }

          // Fetch existing rent split
          const splitRes = await fetch(`/api/rent-splits?unitId=${tenantData.unitId}`);
          if (splitRes.ok) {
            const splitData = await splitRes.json();
            if (splitData) {
              setRentSplit(splitData);
              setSplits(
                splitData.splits.map((s: RentSplitData["splits"][0]) => {
                  const rm = roommatesData.find((r: RoommateInfo) => r.tenantId === s.tenantId);
                  return {
                    tenantId: s.tenantId,
                    name: s.tenant.user.name,
                    percent: s.percent,
                    isPrimary: rm?.isPrimary,
                  };
                })
              );
            }
          }
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  async function handleAddRoommate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAddingRoommate(true);

    const fd = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/tenants/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.get("name"),
          email: fd.get("email"),
          phone: fd.get("phone") || undefined,
          unitId: tenant!.unitId,
          isPrimary: false,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to add roommate");
        setAddingRoommate(false);
        return;
      }

      toast.success("Roommate added! They will receive an invite link.");
      if (data.inviteUrl) {
        toast.info(`Dev invite link: ${data.inviteUrl}`, { duration: 15000 });
      }
      // Reload the page to refresh data
      router.refresh();
      window.location.reload();
    } catch {
      toast.error("Something went wrong");
      setAddingRoommate(false);
    }
  }

  async function handleSaveSplits() {
    const total = splits.reduce((sum, s) => sum + s.percent, 0);
    if (total !== 100) {
      toast.error(`Splits must total 100%. Currently: ${total}%`);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/rent-splits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitId: tenant!.unitId,
          splits: splits.map((s) => ({
            tenantId: s.tenantId,
            percent: s.percent,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to save splits");
        setSaving(false);
        return;
      }

      toast.success("Rent splits updated!");
      setSaving(false);
    } catch {
      toast.error("Something went wrong");
      setSaving(false);
    }
  }

  async function handleRemoveRoommate(tenantId: string) {
    if (!tenant) return;
    setRemovingId(tenantId);
    try {
      const res = await fetch(
        `/api/tenants/${tenantId}/roommates?unitId=${tenant.unitId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to remove roommate");
        setRemovingId(null);
        return;
      }
      toast.success("Roommate removed and splits redistributed.");
      router.refresh();
      window.location.reload();
    } catch {
      toast.error("Something went wrong");
      setRemovingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Tenant not found.</p>
      </div>
    );
  }

  const splitTotal = splits.reduce((sum, s) => sum + s.percent, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roommates & Rent Splits"
        description={`${tenant.propertyName} — Unit ${tenant.unitNumber}`}
      />

      {/* Current Tenants & Splits */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Rent Split — ${tenant.rentAmount}/mo
          </CardTitle>
          <CardDescription>
            Define how rent is split between tenants in this unit. Splits must total 100%.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {splits.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tenants assigned to this unit yet.</p>
          ) : (
            <div className="space-y-4">
              {splits.map((s, i) => (
                <div key={s.tenantId} className="flex items-center gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      ${((tenant.rentAmount * s.percent) / 100).toFixed(2)}/mo
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={99}
                      value={s.percent}
                      onChange={(e) => {
                        let newVal = Number(e.target.value);
                        if (newVal < 1) newVal = 1;
                        if (newVal > 99) newVal = 99;
                        // Ensure total doesn't exceed 100
                        const othersTotal = splits.reduce(
                          (sum, sp, idx) => (idx === i ? sum : sum + sp.percent),
                          0
                        );
                        if (othersTotal + newVal > 100) {
                          newVal = 100 - othersTotal;
                        }
                        const updated = [...splits];
                        updated[i] = { ...updated[i], percent: newVal };
                        setSplits(updated);
                      }}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                    {!s.isPrimary && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        disabled={removingId === s.tenantId}
                        onClick={() => handleRemoveRoommate(s.tenantId)}
                        title="Remove roommate"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between border-t border-border pt-4">
                <p className={`text-sm font-medium ${splitTotal !== 100 ? "text-destructive" : ""}`}>
                  Total: {splitTotal}%
                </p>
                <Button onClick={handleSaveSplits} disabled={saving || splitTotal !== 100}>
                  {saving ? "Saving..." : "Save Splits"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Roommate */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add Roommate
          </CardTitle>
          <CardDescription>
            Add a roommate to this unit. They will receive an invite link to set up their account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddRoommate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rm-name">Full Name</Label>
                <Input id="rm-name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rm-phone">Phone (optional)</Label>
                <Input id="rm-phone" name="phone" type="tel" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rm-email">Email</Label>
              <Input id="rm-email" name="email" type="email" required />
            </div>
            <Button type="submit" disabled={addingRoommate}>
              {addingRoommate ? "Adding..." : "Add Roommate"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

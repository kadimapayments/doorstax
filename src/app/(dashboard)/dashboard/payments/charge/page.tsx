// src/app/(dashboard)/dashboard/payments/charge/page.tsx
//
// REWRITE of the Charge Tenant page with method picker.
//
// New behavior:
// 1. After tenant is selected, fetches /api/tenants/[id]/payment-methods
//    to learn what methods are actually available
// 2. Renders a method picker showing only valid options with helpful labels
//    (e.g. "Card ending 4489" or "No bank on file — disabled")
// 3. Cash/check selections reveal additional fields (check number, etc.)
// 4. Submit posts paymentMethod + method-specific fields to /api/payments/charge
// 5. On success, shows specific feedback ("Charged Visa •••• 4489" or
//    "Recorded receipt MORRISON-1042")

"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// NOTE: dropped `import { Textarea }` — component doesn't exist in this
// codebase and the page never actually rendered it. The description
// field uses <Input> instead.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "sonner";
import { ArrowLeft, Search, User, Building2, CreditCard, Landmark, Banknote, FileText, AlertCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Types ────────────────────────────────────
interface TenantOption {
  tenantId: string;
  unitId: string;
  tenantName: string;
  propertyName: string;
  unitNumber: string;
  rentAmount: number;
}

interface PaymentMethodAvailability {
  tenant: {
    hasCard: boolean;
    cardBrand: string | null;
    cardLast4: string | null;
    hasAch: boolean;
    bankLast4: string | null;
    bankAccountType: string | null;
  };
  owner: {
    acceptsCash: boolean;
    acceptsChecks: boolean;
  };
  available: string[];
}

type Method = "card" | "ach" | "cash" | "check";

export default function ChargeTenantPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [search, setSearch] = useState("");

  // Payment method state
  const [methodAvailability, setMethodAvailability] = useState<PaymentMethodAvailability | null>(null);
  const [methodLoading, setMethodLoading] = useState(false);
  const [method, setMethod] = useState<Method | "">("");

  // Form state
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("RENT");
  const [description, setDescription] = useState("");

  // Check-only state
  const [checkNumber, setCheckNumber] = useState("");
  const [checkDate, setCheckDate] = useState("");
  const [payerBankName, setPayerBankName] = useState("");
  const [memoLine, setMemoLine] = useState("");
  const [checkSubType, setCheckSubType] = useState<"PERSONAL" | "MONEY_ORDER" | "CASHIERS_CHECK">("PERSONAL");

  // ─── Load tenants on mount ───
  useEffect(() => {
    fetch("/api/tenants")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data.tenants || [];
        const options: TenantOption[] = list
          .filter((t: { unitId: string | null }) => t.unitId)
          .map((t: any) => ({
            tenantId: t.tenantId,
            unitId: t.unitId,
            tenantName: t.name,
            propertyName: t.propertyName,
            unitNumber: t.unitNumber,
            rentAmount: t.rentAmount,
          }));
        setTenants(options);
      });
  }, []);

  // ─── Load payment methods when tenant changes ───
  useEffect(() => {
    if (!selectedTenant) {
      setMethodAvailability(null);
      setMethod("");
      return;
    }

    setMethodLoading(true);
    setMethod("");
    fetch(`/api/tenants/${selectedTenant}/payment-methods`)
      .then((r) => r.json())
      .then((data: PaymentMethodAvailability) => {
        setMethodAvailability(data);
        // Auto-select the first available method
        if (data.available.length > 0) {
          setMethod(data.available[0] as Method);
        }
      })
      .catch(() => toast.error("Failed to load payment methods"))
      .finally(() => setMethodLoading(false));
  }, [selectedTenant]);

  const filteredTenants = useMemo(() => {
    if (!search.trim()) return tenants;
    const q = search.toLowerCase();
    return tenants.filter((t) =>
      t.tenantName.toLowerCase().includes(q) ||
      t.propertyName.toLowerCase().includes(q) ||
      t.unitNumber.toLowerCase().includes(q)
    );
  }, [tenants, search]);

  function handleTenantChange(value: string) {
    setSelectedTenant(value);
    const tenant = tenants.find((t) => t.tenantId === value);
    if (tenant) setAmount(String(tenant.rentAmount));
  }

  const selected = tenants.find((t) => t.tenantId === selectedTenant);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedTenant) return toast.error("Please select a tenant");
    if (!method) return toast.error("Please select a payment method");
    if (!selected) return;

    if (method === "check" && !checkNumber.trim()) {
      return toast.error("Check number is required");
    }

    setLoading(true);
    try {
      const res = await fetch("/api/payments/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: selected.tenantId,
          unitId: selected.unitId,
          amount: Number(amount),
          type,
          description: description || undefined,
          paymentMethod: method,
          ...(method === "check" && {
            checkNumber: checkNumber.trim(),
            checkDate: checkDate ? new Date(checkDate).toISOString() : undefined,
            payerBankName: payerBankName.trim() || undefined,
            memoLine: memoLine.trim() || undefined,
            checkSubType,
          }),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to charge tenant");
        return;
      }

      // Method-specific success message
      if (method === "card" && data.charged) {
        toast.success(`Charged ${methodAvailability?.tenant.cardBrand?.toUpperCase() ?? "card"} •••• ${methodAvailability?.tenant.cardLast4 ?? ""}`);
      } else if (method === "ach" && data.charged) {
        toast.success(`ACH initiated — bank •••• ${methodAvailability?.tenant.bankLast4 ?? ""}`);
      } else if (method === "cash" || method === "check") {
        toast.success(`Recorded — receipt ${data.receiptNumber}`);
      } else if (!data.charged) {
        toast.error("Payment was declined. Check the payment record for details.");
      }

      router.push("/dashboard/payments");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // ─── Method picker rendering helpers ───
  const methodOptions: Array<{ value: Method; icon: typeof CreditCard; label: () => string; available: boolean; disabledReason?: string }> = [
    {
      value: "card",
      icon: CreditCard,
      available: methodAvailability?.available.includes("card") ?? false,
      disabledReason: "No card on file",
      label: () => methodAvailability?.tenant.hasCard
        ? `Card — ${methodAvailability.tenant.cardBrand?.toUpperCase() ?? "Card"} •••• ${methodAvailability.tenant.cardLast4 ?? ""}`
        : "Card",
    },
    {
      value: "ach",
      icon: Landmark,
      available: methodAvailability?.available.includes("ach") ?? false,
      disabledReason: "No bank account on file",
      label: () => methodAvailability?.tenant.hasAch
        ? `Bank — ${methodAvailability.tenant.bankAccountType ?? "account"} •••• ${methodAvailability.tenant.bankLast4 ?? ""}`
        : "ACH (Bank)",
    },
    {
      value: "cash",
      icon: Banknote,
      available: methodAvailability?.available.includes("cash") ?? false,
      disabledReason: "Cash not enabled for this property's owner",
      label: () => "Cash",
    },
    {
      value: "check",
      icon: FileText,
      available: methodAvailability?.available.includes("check") ?? false,
      disabledReason: "Checks not enabled for this property's owner",
      label: () => "Check / Money Order",
    },
  ];

  const noMethodsAvailable = methodAvailability && methodAvailability.available.length === 0;

  return (
    <div className="space-y-6">
      <Link href="/dashboard/payments" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Payments
      </Link>

      <PageHeader title="Charge Tenant" description="Create a charge for a tenant." />

      <Card>
        <CardHeader>
          <CardTitle>New Charge</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tenant search */}
            <div className="space-y-2">
              <Label>Tenant</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, property, or unit..."
                />
              </div>
              {filteredTenants.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tenants found.</p>
              ) : (
                <div className="max-h-60 overflow-y-auto rounded-md border divide-y">
                  {filteredTenants.map((t) => (
                    <button
                      key={t.tenantId}
                      type="button"
                      onClick={() => handleTenantChange(t.tenantId)}
                      className={`w-full text-left px-3 py-2.5 text-sm hover:bg-muted/50 ${selectedTenant === t.tenantId ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 font-medium">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          {t.tenantName}
                        </span>
                        <span className="text-xs text-muted-foreground">${t.rentAmount.toFixed(2)}/mo</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground ml-5">
                        <Building2 className="h-3 w-3" />
                        {t.propertyName} — Unit {t.unitNumber}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected tenant + method picker */}
            {selected && (
              <>
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                  <span className="font-medium">{selected.tenantName}</span>
                  <span className="text-muted-foreground"> — {selected.propertyName}, Unit {selected.unitNumber}</span>
                </div>

                {/* Method picker */}
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  {methodLoading && <p className="text-sm text-muted-foreground">Loading available methods...</p>}

                  {noMethodsAvailable && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                      <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium">No payment methods available</p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          Tenant has no card or bank on file, and cash/check aren&apos;t enabled for this property&apos;s owner.
                          Either ask the tenant to add a payment method in their portal, or enable cash/check on the owner page.
                        </p>
                      </div>
                    </div>
                  )}

                  {methodAvailability && !noMethodsAvailable && (
                    <div className="grid grid-cols-2 gap-2">
                      {methodOptions.map((opt) => {
                        const Icon = opt.icon;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            disabled={!opt.available}
                            onClick={() => setMethod(opt.value)}
                            title={!opt.available ? opt.disabledReason : undefined}
                            className={`flex items-center gap-2 rounded-lg border-2 p-3 text-left transition ${
                              method === opt.value
                                ? "border-primary bg-primary/5"
                                : opt.available
                                  ? "border-muted hover:border-muted-foreground/40"
                                  : "border-muted opacity-40 cursor-not-allowed"
                            }`}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="text-sm">{opt.label()}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Amount + type */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount ($)</Label>
                    <Input id="amount" type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={type} onValueChange={setType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="RENT">Rent</SelectItem>
                        <SelectItem value="DEPOSIT">Deposit</SelectItem>
                        <SelectItem value="FEE">Fee</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. March rent, late fee..." />
                </div>

                {/* Check-specific fields */}
                {method === "check" && (
                  <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={checkSubType} onValueChange={(v) => setCheckSubType(v as typeof checkSubType)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PERSONAL">Personal Check</SelectItem>
                          <SelectItem value="MONEY_ORDER">Money Order</SelectItem>
                          <SelectItem value="CASHIERS_CHECK">Cashier&apos;s Check</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="checkNumber">Check / Reference # *</Label>
                        <Input id="checkNumber" value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} placeholder="e.g. 1234" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="checkDate">Date on Check</Label>
                        <Input id="checkDate" type="date" value={checkDate} onChange={(e) => setCheckDate(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="payerBankName">Bank Name</Label>
                      <Input id="payerBankName" value={payerBankName} onChange={(e) => setPayerBankName(e.target.value)} placeholder="e.g. Chase" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="memoLine">Memo Line</Label>
                      <Input id="memoLine" value={memoLine} onChange={(e) => setMemoLine(e.target.value)} placeholder="e.g. March rent" />
                    </div>
                  </div>
                )}

                {/* Submit */}
                <div className="flex gap-3 pt-2">
                  <Button type="submit" disabled={loading || !method || !!noMethodsAvailable}>
                    {loading ? "Processing..." : method === "cash" || method === "check" ? "Record Payment" : "Charge Tenant"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => router.back()}>
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

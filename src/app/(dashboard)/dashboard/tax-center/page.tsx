"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  DollarSign,
  Users,
  FileText,
  AlertTriangle,
  Download,
  FileSpreadsheet,
  Loader2,
  Eye,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

interface OwnerTax {
  id: string;
  name: string;
  email: string | null;
  taxId: string | null;
  taxIdType: string | null;
  hasTaxId: boolean;
  totalGrossRent: number;
  totalFees: number;
  totalNetPayout: number;
  payoutCount: number;
  has1099: boolean;
}

interface VendorTax {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  w9Status: string;
  hasTaxId: boolean;
  totalPaid: number;
}

interface TaxSummary {
  totalDisbursements: number;
  totalOwners: number;
  ownersAboveThreshold: number;
  vendorsAboveThreshold: number;
}

interface TaxData {
  year: number;
  owners: OwnerTax[];
  vendors: VendorTax[];
  summary: TaxSummary;
}

const w9StatusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  NOT_REQUESTED: { label: "Not Requested", color: "bg-muted text-muted-foreground", icon: Clock },
  REQUESTED: { label: "Requested", color: "bg-amber-500/15 text-amber-500 border-amber-500/20", icon: Clock },
  RECEIVED: { label: "Received", color: "bg-blue-500/15 text-blue-500 border-blue-500/20", icon: FileText },
  VERIFIED: { label: "Verified", color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20", icon: CheckCircle2 },
};

export default function TaxCenterPage() {
  const [data, setData] = useState<TaxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tax-center?year=${year}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function generate1099(ownerId: string) {
    setGeneratingId(ownerId);
    try {
      const res = await fetch(
        `/api/tax-center/1099?ownerId=${ownerId}&year=${year}`
      );
      if (res.ok) {
        // Open the PDF
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        toast.success("1099-NEC generated and saved");
        fetchData(); // Refresh to show updated has1099 status
      } else {
        toast.error("Failed to generate 1099");
      }
    } catch {
      toast.error("Failed to generate 1099");
    } finally {
      setGeneratingId(null);
    }
  }

  const vendorsPendingW9 = data?.vendors.filter(
    (v) => v.totalPaid >= 600 && v.w9Status !== "VERIFIED"
  ).length || 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tax Center"
        description="Annual tax summaries, 1099 generation, and vendor W-9 management."
      />

      {/* Year Selector + Export */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Tax Year</Label>
          <select
            className="mt-1 block rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          >
            {[2026, 2025, 2024, 2023].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              window.open(`/api/tax-center/export?year=${year}&format=csv`, "_blank")
            }
          >
            <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              window.open(`/api/tax-center/export?year=${year}&format=pdf`, "_blank")
            }
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Summary Metrics */}
      {data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-stagger">
          <MetricCard
            label="Total Disbursements"
            value={formatCurrency(data.summary.totalDisbursements)}
            icon={<DollarSign className="h-4 w-4" />}
          />
          <MetricCard
            label="Active Owners"
            value={data.summary.totalOwners}
            icon={<Users className="h-4 w-4" />}
          />
          <MetricCard
            label="1099 Required"
            value={data.summary.ownersAboveThreshold}
            icon={<FileText className="h-4 w-4" />}
            className={
              data.summary.ownersAboveThreshold > 0
                ? "border-primary/30 bg-primary/5"
                : undefined
            }
          />
          <MetricCard
            label="W-9 Pending"
            value={vendorsPendingW9}
            icon={<AlertTriangle className="h-4 w-4" />}
            className={
              vendorsPendingW9 > 0
                ? "border-amber-500/30 bg-amber-500/5"
                : undefined
            }
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : !data ? (
        <Card className="border-border">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Unable to load tax data.
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="owners">
          <TabsList>
            <TabsTrigger value="owners">
              Owner 1099s
              {data.summary.ownersAboveThreshold > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs px-1.5">
                  {data.summary.ownersAboveThreshold}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="vendors">
              Vendor W-9s
              {vendorsPendingW9 > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs px-1.5">
                  {vendorsPendingW9}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Owner 1099s Tab ── */}
          <TabsContent value="owners" className="mt-6">
            {data.owners.length === 0 ? (
              <Card className="border-border">
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  No owners found.
                </CardContent>
              </Card>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="pb-2 text-left font-medium">Owner</th>
                      <th className="pb-2 text-left font-medium">TIN Status</th>
                      <th className="pb-2 text-right font-medium">Gross Rent</th>
                      <th className="pb-2 text-right font-medium">Fees</th>
                      <th className="pb-2 text-right font-medium">Net Payout</th>
                      <th className="pb-2 text-center font-medium">1099</th>
                      <th className="pb-2 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.owners.map((owner) => {
                      const above600 = owner.totalNetPayout >= 600;
                      return (
                        <tr
                          key={owner.id}
                          className={`border-b border-border/50 ${
                            above600 ? "bg-primary/[0.02]" : ""
                          }`}
                        >
                          <td className="py-3">
                            <div>
                              <p className="font-medium">{owner.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {owner.email || "No email"}
                              </p>
                            </div>
                          </td>
                          <td className="py-3">
                            {owner.hasTaxId ? (
                              <Badge
                                variant="outline"
                                className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs"
                              >
                                On file
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-xs"
                              >
                                Missing
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 text-right tabular-nums">
                            {formatCurrency(owner.totalGrossRent)}
                          </td>
                          <td className="py-3 text-right tabular-nums text-muted-foreground">
                            {formatCurrency(owner.totalFees)}
                          </td>
                          <td className="py-3 text-right tabular-nums font-semibold">
                            {formatCurrency(owner.totalNetPayout)}
                          </td>
                          <td className="py-3 text-center">
                            {above600 ? (
                              owner.has1099 ? (
                                <Badge
                                  variant="outline"
                                  className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs"
                                >
                                  Generated
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-xs"
                                >
                                  Required
                                </Badge>
                              )
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                Under $600
                              </span>
                            )}
                          </td>
                          <td className="py-3 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={generatingId === owner.id}
                              onClick={() => generate1099(owner.id)}
                            >
                              {generatingId === owner.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : owner.has1099 ? (
                                <Eye className="h-3.5 w-3.5" />
                              ) : (
                                <FileText className="h-3.5 w-3.5" />
                              )}
                              <span className="ml-1.5">
                                {owner.has1099 ? "Regenerate" : "Generate"}
                              </span>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* ── Vendor W-9s Tab ── */}
          <TabsContent value="vendors" className="mt-6">
            {data.vendors.length === 0 ? (
              <Card className="border-border">
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  No vendors found.
                </CardContent>
              </Card>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="pb-2 text-left font-medium">Vendor</th>
                      <th className="pb-2 text-left font-medium">Company</th>
                      <th className="pb-2 text-left font-medium">W-9 Status</th>
                      <th className="pb-2 text-right font-medium">Total Paid</th>
                      <th className="pb-2 text-center font-medium">1099 Req.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.vendors.map((vendor) => {
                      const status = w9StatusConfig[vendor.w9Status] || w9StatusConfig.NOT_REQUESTED;
                      const above600 = vendor.totalPaid >= 600;
                      const StatusIcon = status.icon;
                      return (
                        <tr
                          key={vendor.id}
                          className={`border-b border-border/50 ${
                            above600 && vendor.w9Status !== "VERIFIED" ? "bg-amber-500/[0.03]" : ""
                          }`}
                        >
                          <td className="py-3">
                            <div>
                              <p className="font-medium">{vendor.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {vendor.email || "No email"}
                              </p>
                            </div>
                          </td>
                          <td className="py-3 text-muted-foreground">
                            {vendor.company || "—"}
                          </td>
                          <td className="py-3">
                            <Badge
                              variant="outline"
                              className={`text-xs ${status.color}`}
                            >
                              <StatusIcon className="mr-1 h-3 w-3" />
                              {status.label}
                            </Badge>
                          </td>
                          <td className="py-3 text-right tabular-nums font-medium">
                            {formatCurrency(vendor.totalPaid)}
                          </td>
                          <td className="py-3 text-center">
                            {above600 ? (
                              <CheckCircle2 className="inline h-4 w-4 text-amber-500" />
                            ) : (
                              <XCircle className="inline h-4 w-4 text-muted-foreground/30" />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

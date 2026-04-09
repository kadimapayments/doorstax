"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Receipt,
  Send,
  Shield,
  Settings2,
  Download,
  Eye,
  ChevronDown,
  ChevronUp,
  FileText,
  RefreshCw,
  Mail,
  Loader2,
  Plus,
  FileBarChart,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CreditCard,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";

interface TenantOption {
  tenantId: string;
  name: string;
}
interface OwnerOption {
  id: string;
  name: string;
}
interface PaymentOption {
  id: string;
  amount: number;
  dueDate: string;
  status: string;
  paymentMethod: string | null;
}

interface GeneratedStatement {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string | null;
  name: string;
  url: string;
  period: string | null;
  createdAt: string;
}

export default function StatementsPage() {
  // Branding settings
  const [primaryColor, setPrimaryColor] = useState("#5B00FF");
  const [footerText, setFooterText] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Data
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [owners, setOwners] = useState<OwnerOption[]>([]);
  const [payments, setPayments] = useState<PaymentOption[]>([]);

  // Form state
  const [receiptTenantId, setReceiptTenantId] = useState("");
  const [receiptPaymentId, setReceiptPaymentId] = useState("");
  const [payoutOwnerId, setPayoutOwnerId] = useState("");
  const [payoutMonth, setPayoutMonth] = useState(new Date().getMonth() + 1);
  const [payoutYear, setPayoutYear] = useState(new Date().getFullYear());
  const [rentRecordTenantId, setRentRecordTenantId] = useState("");
  const [rentRecordMonths, setRentRecordMonths] = useState(12);

  // Preview
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");

  // Active card (expanded)
  const [activeCard, setActiveCard] = useState<string | null>(null);

  // Generated statements tab state
  const [generatedDocs, setGeneratedDocs] = useState<GeneratedStatement[]>([]);
  const [generatedLoading, setGeneratedLoading] = useState(false);
  const [generatedYear, setGeneratedYear] = useState(String(new Date().getFullYear()));
  const [generating, setGenerating] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  // Generate form state
  const [genOwnerId, setGenOwnerId] = useState("");
  const [genMonth, setGenMonth] = useState(new Date().getMonth() + 1);
  const [genYear, setGenYear] = useState(new Date().getFullYear());

  // Merchant statements state
  const [merchantConfig, setMerchantConfig] = useState<{
    configured: boolean;
    reason?: string;
    dbaName?: string;
    statements?: Array<{ id: string; date?: string; url?: string }>;
  } | null>(null);
  const [merchantLoading, setMerchantLoading] = useState(false);
  const [merchantReporting, setMerchantReporting] = useState<{
    period: { from: string; to: string; year: number; month: number };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transactions: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    batches: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payouts: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chargebacks: any;
  } | null>(null);
  const [reportingLoading, setReportingLoading] = useState(false);
  const [reportingMonth, setReportingMonth] = useState(new Date().getMonth() + 1);
  const [reportingYear, setReportingYear] = useState(new Date().getFullYear());
  const [emailingId, setEmailingId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Load settings
  useEffect(() => {
    fetch("/api/statements/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.primaryColor) setPrimaryColor(data.primaryColor);
        if (data.footerText) setFooterText(data.footerText);
        if (data.logoUrl) setLogoUrl(data.logoUrl);
      })
      .catch(() => {});
  }, []);

  // Load tenants and owners
  useEffect(() => {
    fetch("/api/tenants")
      .then((r) => r.json())
      .then((data) => setTenants(Array.isArray(data) ? data : []))
      .catch(() => {});
    fetch("/api/owners")
      .then((r) => r.json())
      .then((data) => setOwners(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Load payments when tenant changes
  useEffect(() => {
    if (!receiptTenantId) {
      setPayments([]);
      return;
    }
    fetch(`/api/payments?tenantId=${receiptTenantId}&status=COMPLETED&limit=20`)
      .then((r) => r.json())
      .then((data) => setPayments(Array.isArray(data) ? data : data.payments || []))
      .catch(() => {});
  }, [receiptTenantId]);

  // Load generated statements
  const fetchGenerated = useCallback(async () => {
    setGeneratedLoading(true);
    try {
      const res = await fetch(`/api/statements/generated?year=${generatedYear}`);
      if (res.ok) {
        const data = await res.json();
        setGeneratedDocs(data.documents || []);
      }
    } catch {
      /* ignore */
    } finally {
      setGeneratedLoading(false);
    }
  }, [generatedYear]);

  useEffect(() => {
    fetchGenerated();
  }, [fetchGenerated]);

  async function saveSettings() {
    setSavingSettings(true);
    try {
      await fetch("/api/statements/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryColor, footerText, logoUrl }),
      });
      toast.success("Branding settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  }

  function openPreview(url: string, title: string) {
    setPreviewUrl(url);
    setPreviewTitle(title);
  }

  function formatCurrency(n: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(n);
  }

  async function generateStatement() {
    if (!genOwnerId) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/statements/generated", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: genOwnerId, month: genMonth, year: genYear }),
      });
      if (res.ok) {
        toast.success("Statement generated and sent to owner");
        fetchGenerated();
        setGenOwnerId("");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to generate statement");
      }
    } catch {
      toast.error("Failed to generate statement");
    } finally {
      setGenerating(false);
    }
  }

  async function resendStatement(docId: string) {
    setResendingId(docId);
    try {
      const res = await fetch(`/api/statements/generated/${docId}/resend`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success("Statement email sent");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to send email");
      }
    } catch {
      toast.error("Failed to send email");
    } finally {
      setResendingId(null);
    }
  }

  // ── Merchant statement helpers ──────────────────
  async function fetchMerchantStatements() {
    setMerchantLoading(true);
    try {
      const res = await fetch("/api/merchant-statements");
      if (res.ok) setMerchantConfig(await res.json());
    } catch {
      toast.error("Failed to load merchant statements");
    } finally {
      setMerchantLoading(false);
    }
  }

  async function fetchReporting(year: number, month: number) {
    setReportingLoading(true);
    try {
      const res = await fetch(
        `/api/merchant-statements/reporting?year=${year}&month=${month}`
      );
      if (res.ok) setMerchantReporting(await res.json());
      else setMerchantReporting(null);
    } catch {
      setMerchantReporting(null);
    } finally {
      setReportingLoading(false);
    }
  }

  async function emailStatement(id: string) {
    setEmailingId(id);
    try {
      const res = await fetch(`/api/merchant-statements/email/${id}`, {
        method: "POST",
      });
      if (res.ok) toast.success("Statement emailed to you");
      else toast.error("Failed to send email");
    } catch {
      toast.error("Failed to send email");
    } finally {
      setEmailingId(null);
    }
  }

  const cards = [
    {
      id: "receipt",
      icon: Receipt,
      title: "Tenant Payment Receipt",
      description:
        "Generate a professional payment receipt for any tenant transaction.",
      render: () => (
        <div className="space-y-4 pt-4 border-t border-border">
          <div>
            <Label>Tenant</Label>
            <select
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={receiptTenantId}
              onChange={(e) => {
                setReceiptTenantId(e.target.value);
                setReceiptPaymentId("");
              }}
            >
              <option value="">Select a tenant...</option>
              {tenants.map((t) => (
                <option key={t.tenantId} value={t.tenantId}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          {receiptTenantId && (
            <div>
              <Label>Payment</Label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={receiptPaymentId}
                onChange={(e) => setReceiptPaymentId(e.target.value)}
              >
                <option value="">Select a payment...</option>
                {payments.map((p) => (
                  <option key={p.id} value={p.id}>
                    {new Date(p.dueDate).toLocaleDateString()} —{" "}
                    {formatCurrency(Number(p.amount))} ({p.paymentMethod || "N/A"})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!receiptPaymentId}
              onClick={() =>
                openPreview(
                  `/api/payments/${receiptPaymentId}/receipt`,
                  "Payment Receipt"
                )
              }
            >
              <Eye className="mr-1.5 h-3.5 w-3.5" />
              Preview
            </Button>
            <Button
              size="sm"
              disabled={!receiptPaymentId}
              onClick={() =>
                window.open(`/api/payments/${receiptPaymentId}/receipt`, "_blank")
              }
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Download PDF
            </Button>
          </div>
        </div>
      ),
    },
    {
      id: "payout",
      icon: Send,
      title: "Owner Payout Statement",
      description:
        "Create a detailed monthly payout statement for property owners.",
      render: () => (
        <div className="space-y-4 pt-4 border-t border-border">
          <div>
            <Label>Owner</Label>
            <select
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={payoutOwnerId}
              onChange={(e) => setPayoutOwnerId(e.target.value)}
            >
              <option value="">Select an owner...</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Month</Label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={payoutMonth}
                onChange={(e) => setPayoutMonth(Number(e.target.value))}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(2026, i).toLocaleString("en-US", {
                      month: "long",
                    })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Year</Label>
              <Input
                type="number"
                value={payoutYear}
                onChange={(e) => setPayoutYear(Number(e.target.value))}
                min={2020}
                max={2030}
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!payoutOwnerId}
              onClick={() =>
                openPreview(
                  `/api/statements/payout?ownerId=${payoutOwnerId}&month=${payoutMonth}&year=${payoutYear}`,
                  "Payout Statement"
                )
              }
            >
              <Eye className="mr-1.5 h-3.5 w-3.5" />
              Preview
            </Button>
            <Button
              size="sm"
              disabled={!payoutOwnerId}
              onClick={() =>
                window.open(
                  `/api/statements/payout?ownerId=${payoutOwnerId}&month=${payoutMonth}&year=${payoutYear}`,
                  "_blank"
                )
              }
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Download PDF
            </Button>
          </div>
        </div>
      ),
    },
    {
      id: "rent-record",
      icon: Shield,
      title: "Certified Rent Record",
      description:
        "Produce a certified rent payment history for verification purposes.",
      render: () => (
        <div className="space-y-4 pt-4 border-t border-border">
          <div>
            <Label>Tenant</Label>
            <select
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={rentRecordTenantId}
              onChange={(e) => setRentRecordTenantId(e.target.value)}
            >
              <option value="">Select a tenant...</option>
              {tenants.map((t) => (
                <option key={t.tenantId} value={t.tenantId}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Period</Label>
            <select
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={rentRecordMonths}
              onChange={(e) => setRentRecordMonths(Number(e.target.value))}
            >
              <option value={6}>Last 6 months</option>
              <option value={12}>Last 12 months</option>
              <option value={24}>Last 24 months</option>
              <option value={36}>Last 36 months</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!rentRecordTenantId}
              onClick={() =>
                openPreview(
                  `/api/statements/rent-record?tenantId=${rentRecordTenantId}&months=${rentRecordMonths}`,
                  "Certified Rent Record"
                )
              }
            >
              <Eye className="mr-1.5 h-3.5 w-3.5" />
              Preview
            </Button>
            <Button
              size="sm"
              disabled={!rentRecordTenantId}
              onClick={() =>
                window.open(
                  `/api/statements/rent-record?tenantId=${rentRecordTenantId}&months=${rentRecordMonths}`,
                  "_blank"
                )
              }
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Download PDF
            </Button>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Statements"
        description="Generate, manage, and deliver professional financial documents."
      />

      <Tabs defaultValue="builder">
        <TabsList>
          <TabsTrigger value="builder">Statement Builder</TabsTrigger>
          <TabsTrigger value="generated">
            Generated Statements
            {generatedDocs.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs px-1.5">
                {generatedDocs.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="merchant"
            onClick={() => {
              if (!merchantConfig) fetchMerchantStatements();
            }}
          >
            <FileBarChart className="mr-1.5 h-3.5 w-3.5" />
            Merchant Statements
          </TabsTrigger>
        </TabsList>

        {/* ── Statement Builder Tab ── */}
        <TabsContent value="builder" className="space-y-6 mt-6">
          {/* Branding Settings */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <button
                onClick={() => setSettingsOpen(!settingsOpen)}
                className="flex w-full items-center justify-between"
              >
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-muted-foreground" />
                  Branding Settings
                </CardTitle>
                {settingsOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </CardHeader>
            {settingsOpen && (
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Customize the appearance of generated documents. These settings
                  apply to all statement types.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Primary Color</Label>
                    <div className="mt-1 flex items-center gap-3">
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="h-9 w-12 cursor-pointer rounded border border-input"
                      />
                      <Input
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="font-mono"
                        placeholder="#5B00FF"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Company Logo URL</Label>
                    <Input
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder="https://example.com/logo.png"
                      className="mt-1"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      URL to your company logo for statements. Leave blank to use the DoorStax logo.
                    </p>
                  </div>
                  <div>
                    <Label>Footer Text</Label>
                    <Input
                      value={footerText}
                      onChange={(e) => setFooterText(e.target.value)}
                      placeholder="Optional footer text for documents..."
                      className="mt-1"
                    />
                  </div>
                </div>
                <Button onClick={saveSettings} disabled={savingSettings} size="sm">
                  {savingSettings ? "Saving..." : "Save Settings"}
                </Button>
              </CardContent>
            )}
          </Card>

          {/* Document Cards */}
          <div className="grid gap-6 sm:grid-cols-3">
            {cards.map((card) => {
              const isActive = activeCard === card.id;
              return (
                <Card
                  key={card.id}
                  className="border-border transition-shadow hover:shadow-md"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${primaryColor}15` }}
                      >
                        <card.icon
                          className="h-5 w-5"
                          style={{ color: primaryColor }}
                        />
                      </div>
                      <CardTitle className="text-sm">{card.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {card.description}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() =>
                        setActiveCard(isActive ? null : card.id)
                      }
                    >
                      <FileText className="mr-1.5 h-3.5 w-3.5" />
                      {isActive ? "Close" : "Generate"}
                    </Button>
                    {isActive && card.render()}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ── Generated Statements Tab ── */}
        <TabsContent value="generated" className="space-y-6 mt-6">
          {/* Generate New Statement */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="h-4 w-4 text-muted-foreground" />
                Generate Statement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[180px]">
                  <Label className="text-xs">Owner</Label>
                  <select
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={genOwnerId}
                    onChange={(e) => setGenOwnerId(e.target.value)}
                  >
                    <option value="">Select owner...</option>
                    {owners.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-[140px]">
                  <Label className="text-xs">Month</Label>
                  <select
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={genMonth}
                    onChange={(e) => setGenMonth(Number(e.target.value))}
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {new Date(2026, i).toLocaleString("en-US", { month: "long" })}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-[100px]">
                  <Label className="text-xs">Year</Label>
                  <Input
                    type="number"
                    value={genYear}
                    onChange={(e) => setGenYear(Number(e.target.value))}
                    min={2020}
                    max={2030}
                    className="mt-1"
                  />
                </div>
                <Button
                  size="sm"
                  disabled={!genOwnerId || generating}
                  onClick={generateStatement}
                >
                  {generating ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileText className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {generating ? "Generating..." : "Generate & Send"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Year Filter */}
          <div className="flex items-center gap-3">
            <Label className="text-sm">Year:</Label>
            <select
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              value={generatedYear}
              onChange={(e) => setGeneratedYear(e.target.value)}
            >
              {[2026, 2025, 2024, 2023].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <Button variant="ghost" size="sm" onClick={fetchGenerated}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Statements List */}
          {generatedLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : generatedDocs.length === 0 ? (
            <Card className="border-border">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No generated statements found for {generatedYear}. Use the form above
                to generate one, or they will be auto-generated on the 1st of each month.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {generatedDocs.map((doc) => (
                <Card key={doc.id} className="border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold truncate">{doc.ownerName}</p>
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] px-1.5 shrink-0">
                            {doc.period}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {doc.name} &middot; Generated{" "}
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openPreview(doc.url, doc.name)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(doc.url, "_blank")}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        {doc.ownerEmail && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={resendingId === doc.id}
                            onClick={() => resendStatement(doc.id)}
                          >
                            {resendingId === doc.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Mail className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        {/* ── Merchant Statements Tab ── */}
        <TabsContent value="merchant" className="space-y-6 mt-6">
          {merchantLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!merchantLoading && merchantConfig && !merchantConfig.configured && (
            <Card className="border-border">
              <CardContent className="py-12 text-center">
                <FileBarChart className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">
                  {merchantConfig.reason === "pending_approval"
                    ? "Merchant Application Under Review"
                    : "Merchant Account Not Configured"}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                  {merchantConfig.reason === "pending_approval"
                    ? "Your merchant application is being reviewed. Statements will be available once approved."
                    : "Complete your merchant application to access processing statements and reporting."}
                </p>
                {merchantConfig.reason !== "pending_approval" && (
                  <Button className="mt-4" size="sm" asChild>
                    <a href="/dashboard/onboarding">Start Application</a>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {!merchantLoading && merchantConfig?.configured && (
            <>
              {/* DBA Info */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{merchantConfig.dbaName}</p>
                  <p className="text-xs text-muted-foreground">Merchant processing statements from Kadima Payments</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchMerchantStatements}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Refresh
                </Button>
              </div>

              <div className="grid gap-6 lg:grid-cols-5">
                {/* LEFT: Statement List */}
                <div className="lg:col-span-2 space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Available Statements
                  </h3>
                  {(!merchantConfig.statements || merchantConfig.statements.length === 0) ? (
                    <Card className="border-border">
                      <CardContent className="py-8 text-center text-sm text-muted-foreground">
                        No statements available yet. Statements are generated monthly after your first processing activity.
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {merchantConfig.statements.map((stmt) => (
                        <Card key={stmt.id} className="border-border hover:shadow-sm transition-shadow">
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-medium">
                                  {stmt.date
                                    ? new Date(stmt.date + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long" })
                                    : `Statement ${stmt.id}`}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => window.open(`/api/merchant-statements/download/${stmt.id}`, "_blank")}
                                  title="Download PDF"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  disabled={emailingId === stmt.id}
                                  onClick={() => emailStatement(stmt.id)}
                                  title="Email to me"
                                >
                                  {emailingId === stmt.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Mail className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => openPreview(`/api/merchant-statements/download/${stmt.id}`, "Merchant Statement")}
                                  title="Preview"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                {/* RIGHT: Inline Reporting */}
                <div className="lg:col-span-3 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Monthly Reporting
                    </h3>
                    <div className="flex items-center gap-2">
                      <select
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                        value={reportingMonth}
                        onChange={(e) => setReportingMonth(Number(e.target.value))}
                      >
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {new Date(2026, i).toLocaleString("en-US", { month: "long" })}
                          </option>
                        ))}
                      </select>
                      <select
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                        value={reportingYear}
                        onChange={(e) => setReportingYear(Number(e.target.value))}
                      >
                        {[2026, 2025, 2024].map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchReporting(reportingYear, reportingMonth)}
                      >
                        Load
                      </Button>
                    </div>
                  </div>

                  {reportingLoading && (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  )}

                  {!reportingLoading && !merchantReporting && (
                    <Card className="border-border">
                      <CardContent className="py-8 text-center text-sm text-muted-foreground">
                        Select a month and click Load to view reporting data.
                      </CardContent>
                    </Card>
                  )}

                  {!reportingLoading && merchantReporting && (
                    <Tabs defaultValue="summary">
                      <TabsList>
                        <TabsTrigger value="summary">Summary</TabsTrigger>
                        <TabsTrigger value="payouts">Payouts</TabsTrigger>
                        <TabsTrigger value="transactions">Transactions</TabsTrigger>
                        {merchantReporting.chargebacks?.items?.length > 0 && (
                          <TabsTrigger value="chargebacks">
                            Chargebacks
                            <Badge variant="destructive" className="ml-1.5 text-[10px] px-1">
                              {merchantReporting.chargebacks.items.length}
                            </Badge>
                          </TabsTrigger>
                        )}
                      </TabsList>

                      {/* Summary */}
                      <TabsContent value="summary" className="mt-4">
                        <div className="grid gap-3 grid-cols-2">
                          <Card className="border-border">
                            <CardContent className="p-4">
                              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                <DollarSign className="h-4 w-4" />
                                <span className="text-xs font-medium">Total Volume</span>
                              </div>
                              <p className="text-lg font-bold">
                                {merchantReporting.transactions?.items
                                  ? formatCurrency(
                                      merchantReporting.transactions.items.reduce(
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        (sum: number, t: any) => sum + Number(t.amount || 0),
                                        0
                                      )
                                    )
                                  : "$0.00"}
                              </p>
                            </CardContent>
                          </Card>
                          <Card className="border-border">
                            <CardContent className="p-4">
                              <div className="flex items-center gap-2 text-emerald-500 mb-1">
                                <TrendingUp className="h-4 w-4" />
                                <span className="text-xs font-medium">Total Deposits</span>
                              </div>
                              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                {merchantReporting.payouts?.items
                                  ? formatCurrency(
                                      merchantReporting.payouts.items.reduce(
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        (sum: number, p: any) => sum + Number(p.depositAmount || p.amount || 0),
                                        0
                                      )
                                    )
                                  : "$0.00"}
                              </p>
                            </CardContent>
                          </Card>
                          <Card className="border-border">
                            <CardContent className="p-4">
                              <div className="flex items-center gap-2 text-amber-500 mb-1">
                                <CreditCard className="h-4 w-4" />
                                <span className="text-xs font-medium">Total Fees</span>
                              </div>
                              <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                                {merchantReporting.payouts?.items
                                  ? formatCurrency(
                                      merchantReporting.payouts.items.reduce(
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        (sum: number, p: any) => sum + Number(p.feesTotal || 0),
                                        0
                                      )
                                    )
                                  : "$0.00"}
                              </p>
                            </CardContent>
                          </Card>
                          {merchantReporting.chargebacks?.items?.length > 0 && (
                            <Card className="border-destructive/30">
                              <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-red-500 mb-1">
                                  <AlertTriangle className="h-4 w-4" />
                                  <span className="text-xs font-medium">Chargebacks</span>
                                </div>
                                <p className="text-lg font-bold text-red-600 dark:text-red-400">
                                  {merchantReporting.chargebacks.items.length}
                                </p>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">
                          Period: {merchantReporting.period.from} to {merchantReporting.period.to}
                        </p>
                      </TabsContent>

                      {/* Payouts */}
                      <TabsContent value="payouts" className="mt-4">
                        {merchantReporting.payouts?.items?.length > 0 ? (
                          <div className="rounded-lg border border-border overflow-hidden">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/50">
                                <tr>
                                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Date</th>
                                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Deposit</th>
                                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Fees</th>
                                </tr>
                              </thead>
                              <tbody>
                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                {merchantReporting.payouts.items.map((p: any, i: number) => (
                                  <tr key={i} className="border-t border-border">
                                    <td className="px-3 py-2">{p.processingDate || p.date || "—"}</td>
                                    <td className="px-3 py-2 text-right font-medium">{formatCurrency(Number(p.depositAmount || p.amount || 0))}</td>
                                    <td className="px-3 py-2 text-right text-muted-foreground">{formatCurrency(Number(p.feesTotal || 0))}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-8">No payout data for this period.</p>
                        )}
                      </TabsContent>

                      {/* Transactions */}
                      <TabsContent value="transactions" className="mt-4">
                        {merchantReporting.transactions?.items?.length > 0 ? (
                          <div className="rounded-lg border border-border overflow-hidden max-h-[400px] overflow-y-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/50 sticky top-0">
                                <tr>
                                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Date</th>
                                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Card</th>
                                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Amount</th>
                                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Type</th>
                                </tr>
                              </thead>
                              <tbody>
                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                {merchantReporting.transactions.items.map((t: any, i: number) => (
                                  <tr key={i} className="border-t border-border">
                                    <td className="px-3 py-2 text-xs">{t.date || t.transactionDate || "—"}</td>
                                    <td className="px-3 py-2 text-xs">
                                      <span className="font-medium">{t.cardBrand || t.cardType || ""}</span>
                                      {t.cardLast4 && <span className="text-muted-foreground"> ****{t.cardLast4}</span>}
                                    </td>
                                    <td className="px-3 py-2 text-right font-medium">{formatCurrency(Number(t.amount || 0))}</td>
                                    <td className="px-3 py-2">
                                      <Badge variant="outline" className="text-[10px]">
                                        {t.type || t.transactionType || "sale"}
                                      </Badge>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-8">No transaction data for this period.</p>
                        )}
                      </TabsContent>

                      {/* Chargebacks */}
                      {merchantReporting.chargebacks?.items?.length > 0 && (
                        <TabsContent value="chargebacks" className="mt-4">
                          <div className="rounded-lg border border-red-500/20 overflow-hidden">
                            <table className="w-full text-sm">
                              <thead className="bg-red-500/5">
                                <tr>
                                  <th className="text-left px-3 py-2 text-xs font-medium text-red-700 dark:text-red-400">Date</th>
                                  <th className="text-right px-3 py-2 text-xs font-medium text-red-700 dark:text-red-400">Amount</th>
                                  <th className="text-left px-3 py-2 text-xs font-medium text-red-700 dark:text-red-400">Reason</th>
                                  <th className="text-left px-3 py-2 text-xs font-medium text-red-700 dark:text-red-400">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                {merchantReporting.chargebacks.items.map((cb: any, i: number) => (
                                  <tr key={i} className="border-t border-red-500/10">
                                    <td className="px-3 py-2 text-xs">{cb.datePosted || cb.date || "—"}</td>
                                    <td className="px-3 py-2 text-right font-medium text-red-600">{formatCurrency(Number(cb.amount || 0))}</td>
                                    <td className="px-3 py-2 text-xs">{cb.reasonDescription || cb.reasonCode || "—"}</td>
                                    <td className="px-3 py-2">
                                      <Badge variant={cb.attention === "Yes" ? "destructive" : "outline"} className="text-[10px]">
                                        {cb.status || "Processed"}
                                      </Badge>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </TabsContent>
                      )}
                    </Tabs>
                  )}
                </div>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Preview Sheet */}
      <Sheet open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <SheetContent className="w-[640px] sm:max-w-[640px]">
          <SheetHeader>
            <SheetTitle>{previewTitle}</SheetTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => previewUrl && window.open(previewUrl, "_blank")}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Download PDF
            </Button>
          </SheetHeader>
          {previewUrl && (
            <div className="mt-4 h-[calc(100vh-120px)]">
              <iframe
                src={previewUrl}
                className="h-full w-full rounded-md border border-border"
                title="PDF Preview"
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

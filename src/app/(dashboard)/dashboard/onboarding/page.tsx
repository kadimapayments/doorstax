"use client";

export const dynamic = "force-dynamic";

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
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, Plus, X, Info } from "lucide-react";
import { EinInput, stripEin } from "@/components/ui/ein-input";
import { PhoneInput, stripPhone } from "@/components/ui/phone-input";
import { COMPLIANCE_WINDOW_DAYS } from "@/lib/constants";

const STEPS = [
  "Business Info",
  "Contact & Location",
  "Principals / Owners",
  "Processing Details",
  "General Info",
  "Bank & Questionnaire",
  "Review & Submit",
  "Sign Agreement",
];

interface PrincipalData {
  firstName: string;
  lastName: string;
  title?: string;
  dob?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  ownershipPercent?: number;
  isManager?: boolean;
  ssn?: string;
  driversLicense?: string;
  driversLicenseExp?: string;
  email?: string;
  phone?: string;
}

const EMPTY_PRINCIPAL: PrincipalData = {
  firstName: "",
  lastName: "",
  title: "",
  dob: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  ownershipPercent: undefined,
  isManager: false,
  ssn: "",
  driversLicense: "",
  driversLicenseExp: "",
  email: "",
  phone: "",
};

interface AppData {
  // step 1
  businessLegalName?: string;
  dba?: string;
  businessType?: string;
  ein?: string;
  yearsInBusiness?: number;
  stockSymbol?: string;
  // step 2
  businessAddress?: string;
  businessCity?: string;
  businessState?: string;
  businessZip?: string;
  businessPhone?: string;
  faxNumber?: string;
  businessEmail?: string;
  websiteUrl?: string;
  buildingType?: string;
  merchantOwnsOrRents?: string;
  areaZoned?: string;
  squareFootage?: string;
  // step 3
  principalFirstName?: string;
  principalLastName?: string;
  principalTitle?: string;
  principalDob?: string;
  principalAddress?: string;
  principalCity?: string;
  principalState?: string;
  principalZip?: string;
  ownershipPercent?: number;
  principals?: PrincipalData[];
  // step 4
  numberOfBuildings?: number;
  numberOfUnits?: number;
  averageTransaction?: number;
  maxTransactionAmount?: number;
  monthlyVolume?: number;
  amexMonthlyVolume?: number;
  productDescription?: string;
  mccCode?: string;
  salesMethodInPerson?: number;
  salesMethodMailPhone?: number;
  salesMethodEcommerce?: number;
  // step 5
  bankruptcyHistory?: string;
  bankruptcyExplanation?: string;
  currentlyProcessCards?: string;
  currentProcessor?: string;
  everTerminated?: string;
  terminatedExplanation?: string;
  acceptVisa?: boolean;
  acceptAmex?: boolean;
  acceptPinDebit?: boolean;
  acceptEbt?: boolean;
  amexOptOut?: boolean;
  // step 6
  bankRoutingNumber?: string;
  bankAccountNumber?: string;
  bankAccountUsage?: string;
  refundPolicy?: string;
  equipmentUsed?: string;
  recurringServices?: string;
  customerProfileConsumer?: number;
  customerProfileBusiness?: number;
  customerProfileGovernment?: number;
  customerLocationLocal?: number;
  customerLocationNational?: number;
  customerLocationInternational?: number;
  fulfillmentTiming?: string;
  deliveryTiming?: string;
  chargedAt?: string;
  hasRetailLocation?: string;
  retailLocationAddress?: string;
  advertisingMethods?: string;
  isSeasonal?: string;
  seasonalMonths?: string[];
  // meta
  currentStep?: number;
  status?: string;
  createdAt?: string;
  agreementSignedAt?: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<AppData>({});
  const [principals, setPrincipals] = useState<PrincipalData[]>([{ ...EMPTY_PRINCIPAL, isManager: true }]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [expired, setExpired] = useState(false);

  // Step 1 controlled state
  const [businessType, setBusinessType] = useState("");

  // Step 5 controlled state
  const [bankruptcyHistory, setBankruptcyHistory] = useState("never");
  const [bankruptcyExplanation, setBankruptcyExplanation] = useState("");
  const [currentlyProcessCards, setCurrentlyProcessCards] = useState("no");
  const [currentProcessor, setCurrentProcessor] = useState("");
  const [everTerminated, setEverTerminated] = useState("no");
  const [terminatedExplanation, setTerminatedExplanation] = useState("");
  const [acceptVisa, setAcceptVisa] = useState(true);
  const [acceptAmex, setAcceptAmex] = useState(false);
  const [acceptPinDebit, setAcceptPinDebit] = useState(false);
  const [acceptEbt, setAcceptEbt] = useState(false);
  const [amexOptOut, setAmexOptOut] = useState(false);

  // Step 6 controlled state
  const [chargedAt, setChargedAt] = useState("time_of_order");
  const [hasRetailLocation, setHasRetailLocation] = useState("no");
  const [retailLocationAddress, setRetailLocationAddress] = useState("");
  const [isSeasonal, setIsSeasonal] = useState("no");
  const [seasonalMonths, setSeasonalMonths] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/boarding")
      .then((r) => r.json())
      .then((app) => {
        if (app && app.id) {
          setData(app);
          // Initialize principals from API response or fallback to legacy fields
          if (app.principals && app.principals.length > 0) {
            setPrincipals(app.principals.map((p: PrincipalData & { dob?: string }) => ({
              firstName: p.firstName || "",
              lastName: p.lastName || "",
              title: p.title || "",
              dob: p.dob ? String(p.dob).slice(0, 10) : "",
              address: p.address || "",
              city: p.city || "",
              state: p.state || "",
              zip: p.zip || "",
              ownershipPercent: p.ownershipPercent ?? undefined,
              isManager: p.isManager ?? false,
              ssn: p.ssn || "",
              driversLicense: p.driversLicense || "",
              driversLicenseExp: p.driversLicenseExp || "",
              email: p.email || "",
              phone: p.phone || "",
            })));
          } else if (app.principalFirstName) {
            setPrincipals([{
              firstName: app.principalFirstName || "",
              lastName: app.principalLastName || "",
              title: app.principalTitle || "",
              dob: app.principalDob ? String(app.principalDob).slice(0, 10) : "",
              address: app.principalAddress || "",
              city: app.principalCity || "",
              state: app.principalState || "",
              zip: app.principalZip || "",
              ownershipPercent: app.ownershipPercent ?? undefined,
              isManager: true,
              ssn: "",
              driversLicense: "",
              driversLicenseExp: "",
              email: "",
              phone: "",
            }]);
          }

          // Restore step 1 controlled state
          if (app.businessType) setBusinessType(app.businessType);

          // Restore step 5 controlled state
          if (app.bankruptcyHistory) setBankruptcyHistory(app.bankruptcyHistory);
          if (app.bankruptcyExplanation) setBankruptcyExplanation(app.bankruptcyExplanation);
          if (app.currentlyProcessCards) setCurrentlyProcessCards(app.currentlyProcessCards);
          if (app.currentProcessor) setCurrentProcessor(app.currentProcessor);
          if (app.everTerminated) setEverTerminated(app.everTerminated);
          if (app.terminatedExplanation) setTerminatedExplanation(app.terminatedExplanation);
          if (app.acceptVisa !== undefined) setAcceptVisa(app.acceptVisa);
          if (app.acceptAmex !== undefined) setAcceptAmex(app.acceptAmex);
          if (app.acceptPinDebit !== undefined) setAcceptPinDebit(app.acceptPinDebit);
          if (app.acceptEbt !== undefined) setAcceptEbt(app.acceptEbt);
          if (app.amexOptOut !== undefined) setAmexOptOut(app.amexOptOut);

          // Restore step 6 controlled state
          if (app.chargedAt) setChargedAt(app.chargedAt);
          if (app.hasRetailLocation) setHasRetailLocation(app.hasRetailLocation);
          if (app.retailLocationAddress) setRetailLocationAddress(app.retailLocationAddress);
          if (app.isSeasonal) setIsSeasonal(app.isSeasonal);
          if (app.seasonalMonths) setSeasonalMonths(app.seasonalMonths);

          if (app.status === "SUBMITTED") {
            setStep(7);
          } else {
            setStep(app.currentStep || 1);
          }

          // Calculate days remaining in compliance window
          if (app.createdAt) {
            const daysSince = Math.floor(
              (Date.now() - new Date(app.createdAt).getTime()) / (1000 * 60 * 60 * 24)
            );
            const remaining = Math.max(0, COMPLIANCE_WINDOW_DAYS - daysSince);
            setDaysRemaining(remaining);
            if (remaining <= 0 && app.status !== "SUBMITTED" && app.status !== "APPROVED") {
              setExpired(true);
            }
          }
        }
        setFetching(false);
      })
      .catch(() => setFetching(false));
  }, []);

  function getFormData(form: HTMLFormElement): Record<string, string> {
    const fd = new FormData(form);
    const obj: Record<string, string> = {};
    fd.forEach((v, k) => {
      if (v) obj[k] = v as string;
    });
    // Strip EIN formatting
    if (obj.ein) obj.ein = stripEin(obj.ein);
    // Strip phone formatting
    if (obj.businessPhone) obj.businessPhone = stripPhone(obj.businessPhone);
    if (obj.faxNumber) obj.faxNumber = stripPhone(obj.faxNumber);
    return obj;
  }

  async function saveStep(formData: Record<string, unknown>, nextStep: number) {
    setLoading(true);
    try {
      const res = await fetch("/api/boarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: nextStep, data: formData }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to save");
        setLoading(false);
        return false;
      }
      const updated = await res.json();
      setData(updated);
      return true;
    } catch {
      toast.error("Something went wrong");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function handleNext(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = getFormData(e.currentTarget);
    const ok = await saveStep(formData, step + 1);
    if (ok) setStep(step + 1);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await saveStep({}, 7);
    if (ok) {
      toast.success("Application submitted!");
      setStep(8);
      setData((d) => ({ ...d, status: "SUBMITTED" }));
    }
  }

  // Helper: update a single principal field
  function updatePrincipal(idx: number, field: keyof PrincipalData, value: unknown) {
    const updated = [...principals];
    updated[idx] = { ...updated[idx], [field]: value };
    setPrincipals(updated);
  }

  // Helper: mask SSN input (show only last 4)
  function formatSsnDisplay(value: string): string {
    const digits = value.replace(/\D/g, "").slice(0, 9);
    if (digits.length <= 4) return digits;
    const masked = "*".repeat(digits.length - 4) + digits.slice(-4);
    if (masked.length > 5) return masked.slice(0, 3) + "-" + masked.slice(3, 5) + "-" + masked.slice(5);
    if (masked.length > 3) return masked.slice(0, 3) + "-" + masked.slice(3);
    return masked;
  }

  // Review helper
  function ReviewRow({ label, value }: { label: string; value?: string | number | boolean | null }) {
    const display = value === true ? "Yes" : value === false ? "No" : value || "—";
    return (
      <div className="flex justify-between border-b border-border pb-2">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-right max-w-[60%]">{String(display)}</span>
      </div>
    );
  }

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="space-y-6">
        <PageHeader title="Merchant Application" />
        <Card className="max-w-2xl border-border">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <AlertTriangle className="h-16 w-16 text-destructive" />
            <h2 className="text-xl font-semibold">Application Period Expired</h2>
            <p className="text-center text-muted-foreground">
              Your {COMPLIANCE_WINDOW_DAYS}-day application window has expired. Please contact support to restart your application.
            </p>
            <Button onClick={() => router.push("/dashboard")}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (data.status === "SUBMITTED" || data.status === "APPROVED") {
    return (
      <div className="space-y-6">
        <PageHeader title="Merchant Application" />
        <Card className="max-w-2xl border-border">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <h2 className="text-xl font-semibold">
              {data.status === "APPROVED"
                ? "Application Approved"
                : "Application Submitted"}
            </h2>
            <p className="text-center text-muted-foreground">
              {data.status === "APPROVED"
                ? "Your merchant account is active. You can now accept payments."
                : "Your application is under review. We'll notify you once it's approved."}
            </p>
            <div className="flex gap-2">
              <Button onClick={() => router.push("/dashboard")}>
                Back to Dashboard
              </Button>
              <Button variant="outline" onClick={() => router.push("/dashboard/properties/import")}>
                Import Properties from CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Merchant Application"
        description="Complete your merchant application to start accepting payments."
      />

      {/* Days remaining indicator */}
      {daysRemaining !== null && daysRemaining > 0 && (
        <p className={`text-sm font-medium ${
          daysRemaining <= 3 ? "text-destructive" : daysRemaining <= 7 ? "text-amber-500" : "text-muted-foreground"
        }`}>
          {daysRemaining} day{daysRemaining !== 1 ? "s" : ""} remaining
        </p>
      )}

      {/* Step indicator */}
      <div className="flex items-center gap-1 sm:gap-2 max-w-3xl">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-1 sm:gap-2 flex-1">
            <div
              className={`flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                i + 1 < step
                  ? "bg-green-500/20 text-green-500"
                  : i + 1 === step
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1 < step ? "✓" : i + 1}
            </div>
            <span className="hidden lg:block text-xs text-muted-foreground truncate">
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div className="h-px flex-1 bg-border" />
            )}
          </div>
        ))}
      </div>

      <Card className="max-w-3xl border-border">
        <CardHeader>
          <CardTitle className="text-base">{STEPS[step - 1]}</CardTitle>
          <CardDescription>Step {step} of {STEPS.length}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* ──────────────── STEP 1: Business Information ──────────────── */}
          {step === 1 && (
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = getFormData(e.currentTarget);
              // Add controlled select value
              formData.businessType = businessType;
              saveStep(formData, step + 1).then((ok) => { if (ok) setStep(step + 1); });
            }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="businessLegalName">Legal Business Name *</Label>
                <Input
                  id="businessLegalName"
                  name="businessLegalName"
                  defaultValue={data.businessLegalName || ""}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dba">DBA (Doing Business As)</Label>
                <Input id="dba" name="dba" defaultValue={data.dba || ""} />
              </div>
              <div className="space-y-2">
                <Label>Business Type</Label>
                <Select
                  name="businessType"
                  value={businessType}
                  onValueChange={setBusinessType}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sole_proprietor">Sole Proprietor</SelectItem>
                    <SelectItem value="llc">LLC</SelectItem>
                    <SelectItem value="corporation">Corporation</SelectItem>
                    <SelectItem value="partnership">Partnership</SelectItem>
                    <SelectItem value="nonprofit">Non-Profit</SelectItem>
                    <SelectItem value="government">Government</SelectItem>
                    <SelectItem value="publicly_traded">Publicly Traded</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ein">EIN / Tax ID</Label>
                <EinInput id="ein" name="ein" defaultValue={data.ein || ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="yearsInBusiness">Years in Business</Label>
                <Input
                  id="yearsInBusiness"
                  name="yearsInBusiness"
                  type="number"
                  min="0"
                  defaultValue={data.yearsInBusiness ?? ""}
                />
              </div>
              {businessType === "publicly_traded" && (
                <div className="space-y-2">
                  <Label htmlFor="stockSymbol">Stock Symbol</Label>
                  <Input
                    id="stockSymbol"
                    name="stockSymbol"
                    defaultValue={data.stockSymbol || ""}
                    placeholder="e.g. NASDAQ:ACME"
                  />
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="submit" disabled={loading}>
                  {loading ? "Saving..." : "Next"}
                </Button>
              </div>
            </form>
          )}

          {/* ──────────────── STEP 2: Business Contact & Location ──────────────── */}
          {step === 2 && (
            <form onSubmit={handleNext} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="businessAddress">Address *</Label>
                <Input id="businessAddress" name="businessAddress" defaultValue={data.businessAddress || ""} required />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="businessCity">City *</Label>
                  <Input id="businessCity" name="businessCity" defaultValue={data.businessCity || ""} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessState">State *</Label>
                  <Input id="businessState" name="businessState" defaultValue={data.businessState || ""} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessZip">ZIP *</Label>
                  <Input id="businessZip" name="businessZip" defaultValue={data.businessZip || ""} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="businessPhone">Phone *</Label>
                  <PhoneInput id="businessPhone" name="businessPhone" defaultValue={data.businessPhone || ""} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="faxNumber">Fax Number</Label>
                  <PhoneInput id="faxNumber" name="faxNumber" defaultValue={data.faxNumber || ""} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="businessEmail">Email *</Label>
                  <Input id="businessEmail" name="businessEmail" type="email" defaultValue={data.businessEmail || ""} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="websiteUrl">Website (optional)</Label>
                  <Input id="websiteUrl" name="websiteUrl" defaultValue={data.websiteUrl || ""} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Building Type</Label>
                  <Select name="buildingType" defaultValue={data.buildingType || ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shopping_center">Shopping Center</SelectItem>
                      <SelectItem value="office_building">Office Building</SelectItem>
                      <SelectItem value="industrial_building">Industrial Building</SelectItem>
                      <SelectItem value="residence">Residence</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Area Zoned</Label>
                  <Select name="areaZoned" defaultValue={data.areaZoned || ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="commercial">Commercial</SelectItem>
                      <SelectItem value="industrial">Industrial</SelectItem>
                      <SelectItem value="residential">Residential</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Owns or Rents</Label>
                  <div className="flex gap-4 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="merchantOwnsOrRents" value="owns" defaultChecked={data.merchantOwnsOrRents === "owns"} className="accent-primary h-4 w-4" />
                      <span className="text-sm">Owns</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="merchantOwnsOrRents" value="rents" defaultChecked={data.merchantOwnsOrRents === "rents"} className="accent-primary h-4 w-4" />
                      <span className="text-sm">Rents</span>
                    </label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Square Footage</Label>
                  <Select name="squareFootage" defaultValue={data.squareFootage || ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0-500">0 - 500 sq ft</SelectItem>
                      <SelectItem value="501-2500">501 - 2,500 sq ft</SelectItem>
                      <SelectItem value="2501-5000">2,501 - 5,000 sq ft</SelectItem>
                      <SelectItem value="5000-10000">5,000 - 10,000 sq ft</SelectItem>
                      <SelectItem value="10000+">10,000+ sq ft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Next"}</Button>
              </div>
            </form>
          )}

          {/* ──────────────── STEP 3: Principals / Owners ──────────────── */}
          {step === 3 && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (principals.length === 0 || !principals[0].firstName || !principals[0].lastName) {
                  toast.error("At least one owner/principal is required.");
                  return;
                }
                if (!principals.some((p) => p.isManager)) {
                  toast.error("One owner must be designated as the manager.");
                  return;
                }
                const totalOwnership = principals.reduce((sum, p) => sum + (p.ownershipPercent || 0), 0);
                if (totalOwnership > 100) {
                  toast.error("Total ownership percentage cannot exceed 100%.");
                  return;
                }
                // Strip phone numbers from principals before sending
                const cleanedPrincipals = principals.map((p) => ({
                  ...p,
                  phone: p.phone ? stripPhone(p.phone) : "",
                  ssn: p.ssn ? p.ssn.replace(/\D/g, "") : "",
                }));
                const primary = cleanedPrincipals[0];
                const formData: Record<string, unknown> = {
                  principalFirstName: primary.firstName,
                  principalLastName: primary.lastName,
                  principalTitle: primary.title || "",
                  principalDob: primary.dob || "",
                  principalAddress: primary.address || "",
                  principalCity: primary.city || "",
                  principalState: primary.state || "",
                  principalZip: primary.zip || "",
                  ownershipPercent: primary.ownershipPercent ?? "",
                  principals: cleanedPrincipals,
                };
                const ok = await saveStep(formData, step + 1);
                if (ok) setStep(step + 1);
              }}
              className="space-y-4"
            >
              <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 p-3 text-sm">
                <Info className="h-4 w-4 mt-0.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="text-blue-800 dark:text-blue-200">
                  All individuals with 25% or more ownership of the business must be listed on this application.
                  {principals.length > 1 && " One owner must be designated as the manager."}
                </span>
              </div>

              {principals.map((principal, idx) => (
                <div key={idx} className="space-y-4 rounded-lg border border-border p-4 relative">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">
                      {idx === 0 ? "Primary Owner" : `Additional Owner ${idx}`}
                    </h4>
                    {idx > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          const updated = principals.filter((_, i) => i !== idx);
                          if (principal.isManager && updated.length > 0) {
                            updated[0] = { ...updated[0], isManager: true };
                          }
                          setPrincipals(updated);
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>First Name *</Label>
                      <Input
                        value={principal.firstName}
                        onChange={(e) => updatePrincipal(idx, "firstName", e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Last Name *</Label>
                      <Input
                        value={principal.lastName}
                        onChange={(e) => updatePrincipal(idx, "lastName", e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        value={principal.title || ""}
                        onChange={(e) => updatePrincipal(idx, "title", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Date of Birth</Label>
                      <Input
                        type="date"
                        value={principal.dob || ""}
                        onChange={(e) => updatePrincipal(idx, "dob", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>SSN</Label>
                      <Input
                        placeholder="***-**-1234"
                        value={principal.ssn ? formatSsnDisplay(principal.ssn) : ""}
                        onChange={(e) => {
                          // Extract raw digits typed, allow up to 9
                          const raw = e.target.value.replace(/[^0-9*]/g, "");
                          // If user is typing new digits (not just masked chars), capture them
                          const existingDigits = (principal.ssn || "").replace(/\D/g, "");
                          const newChar = raw.replace(/\*/g, "");
                          // Simple approach: if input has fewer chars than current, user is deleting
                          if (raw.length < formatSsnDisplay(existingDigits).replace(/[^0-9*]/g, "").length) {
                            const trimmed = existingDigits.slice(0, -1);
                            updatePrincipal(idx, "ssn", trimmed);
                          } else {
                            // Append new digit
                            const lastChar = e.target.value.slice(-1);
                            if (/\d/.test(lastChar) && existingDigits.length < 9) {
                              updatePrincipal(idx, "ssn", existingDigits + lastChar);
                            }
                          }
                        }}
                        maxLength={11}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={principal.email || ""}
                        onChange={(e) => updatePrincipal(idx, "email", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Driver&apos;s License #</Label>
                      <Input
                        value={principal.driversLicense || ""}
                        onChange={(e) => updatePrincipal(idx, "driversLicense", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>DL Expiration (MM/YY)</Label>
                      <Input
                        placeholder="MM/YY"
                        value={principal.driversLicenseExp || ""}
                        onChange={(e) => {
                          let val = e.target.value.replace(/[^\d/]/g, "");
                          if (val.length === 2 && !val.includes("/") && (principal.driversLicenseExp || "").length < 2) {
                            val = val + "/";
                          }
                          if (val.length <= 5) {
                            updatePrincipal(idx, "driversLicenseExp", val);
                          }
                        }}
                        maxLength={5}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <PhoneInput
                      value={principal.phone || ""}
                      onChange={(e) => updatePrincipal(idx, "phone", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Home Address</Label>
                    <Input
                      value={principal.address || ""}
                      onChange={(e) => updatePrincipal(idx, "address", e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>City</Label>
                      <Input
                        value={principal.city || ""}
                        onChange={(e) => updatePrincipal(idx, "city", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>State</Label>
                      <Input
                        value={principal.state || ""}
                        onChange={(e) => updatePrincipal(idx, "state", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>ZIP</Label>
                      <Input
                        value={principal.zip || ""}
                        onChange={(e) => updatePrincipal(idx, "zip", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Ownership %</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={principal.ownershipPercent ?? ""}
                        onChange={(e) => updatePrincipal(idx, "ownershipPercent", e.target.value ? parseInt(e.target.value) : undefined)}
                      />
                    </div>
                    <div className="flex items-end pb-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="managerPrincipal"
                          checked={principal.isManager === true}
                          onChange={() => {
                            const updated = principals.map((p, i) => ({
                              ...p,
                              isManager: i === idx,
                            }));
                            setPrincipals(updated);
                          }}
                          className="accent-primary h-4 w-4"
                        />
                        <span className="text-sm font-medium">Designated Manager</span>
                      </label>
                    </div>
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setPrincipals([...principals, { ...EMPTY_PRINCIPAL }])}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Another Owner
              </Button>

              <div className="flex justify-between pt-2">
                <Button type="button" variant="outline" onClick={() => setStep(2)}>Back</Button>
                <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Next"}</Button>
              </div>
            </form>
          )}

          {/* ──────────────── STEP 4: Processing Details ──────────────── */}
          {step === 4 && (
            <form onSubmit={handleNext} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Tell us about your property portfolio so we can set up the right processing configuration.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="numberOfBuildings">Number of Buildings *</Label>
                  <Input id="numberOfBuildings" name="numberOfBuildings" type="number" min="1" defaultValue={data.numberOfBuildings ?? ""} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numberOfUnits">Total Units *</Label>
                  <Input id="numberOfUnits" name="numberOfUnits" type="number" min="1" defaultValue={data.numberOfUnits ?? ""} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="averageTransaction">Avg. Transaction ($)</Label>
                  <Input id="averageTransaction" name="averageTransaction" type="number" step="0.01" min="0" defaultValue={data.averageTransaction ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxTransactionAmount">Max Transaction ($)</Label>
                  <Input id="maxTransactionAmount" name="maxTransactionAmount" type="number" step="0.01" min="0" defaultValue={data.maxTransactionAmount ?? ""} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="monthlyVolume">Est. Monthly Volume ($)</Label>
                  <Input id="monthlyVolume" name="monthlyVolume" type="number" step="0.01" min="0" defaultValue={data.monthlyVolume ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amexMonthlyVolume">Amex Monthly Volume ($)</Label>
                  <Input id="amexMonthlyVolume" name="amexMonthlyVolume" type="number" step="0.01" min="0" defaultValue={data.amexMonthlyVolume ?? ""} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="productDescription">Product/Service Description</Label>
                <textarea
                  id="productDescription"
                  name="productDescription"
                  rows={2}
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  defaultValue={data.productDescription || "Property Management / Rent Collection"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mccCode">MCC/SIC Code</Label>
                <Input id="mccCode" name="mccCode" defaultValue={data.mccCode || "6513"} />
              </div>

              <div className="space-y-2">
                <Label>Sales Method (must total 100%)</Label>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">In Person %</Label>
                    <Input id="salesMethodInPerson" name="salesMethodInPerson" type="number" min="0" max="100" defaultValue={data.salesMethodInPerson ?? "0"} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Mail/Phone %</Label>
                    <Input id="salesMethodMailPhone" name="salesMethodMailPhone" type="number" min="0" max="100" defaultValue={data.salesMethodMailPhone ?? "0"} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">E-Commerce %</Label>
                    <Input id="salesMethodEcommerce" name="salesMethodEcommerce" type="number" min="0" max="100" defaultValue={data.salesMethodEcommerce ?? "100"} />
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Button type="button" variant="outline" onClick={() => setStep(3)}>Back</Button>
                <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Next"}</Button>
              </div>
            </form>
          )}

          {/* ──────────────── STEP 5: General Information ──────────────── */}
          {step === 5 && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData: Record<string, unknown> = {
                  bankruptcyHistory,
                  bankruptcyExplanation: bankruptcyHistory !== "never" ? bankruptcyExplanation : "",
                  currentlyProcessCards,
                  currentProcessor: currentlyProcessCards === "yes" ? currentProcessor : "",
                  everTerminated,
                  terminatedExplanation: everTerminated === "yes" ? terminatedExplanation : "",
                  acceptVisa,
                  acceptAmex,
                  acceptPinDebit,
                  acceptEbt,
                  amexOptOut,
                };
                const ok = await saveStep(formData, step + 1);
                if (ok) setStep(step + 1);
              }}
              className="space-y-6"
            >
              {/* Bankruptcy */}
              <div className="space-y-2">
                <Label>Has this business or any principal ever filed for bankruptcy?</Label>
                <div className="flex flex-col gap-2 pt-1">
                  {[
                    { value: "business_bankruptcy", label: "Business Bankruptcy" },
                    { value: "personal_bankruptcy", label: "Personal Bankruptcy" },
                    { value: "never", label: "Never" },
                  ].map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="bankruptcyHistory"
                        value={opt.value}
                        checked={bankruptcyHistory === opt.value}
                        onChange={() => setBankruptcyHistory(opt.value)}
                        className="accent-primary h-4 w-4"
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
                {bankruptcyHistory !== "never" && (
                  <div className="space-y-1 pt-2">
                    <Label className="text-xs text-muted-foreground">Please explain</Label>
                    <textarea
                      rows={3}
                      className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={bankruptcyExplanation}
                      onChange={(e) => setBankruptcyExplanation(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Currently process cards */}
              <div className="space-y-2">
                <Label>Does the business currently accept credit cards?</Label>
                <div className="flex gap-4 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="yes" checked={currentlyProcessCards === "yes"} onChange={() => setCurrentlyProcessCards("yes")} className="accent-primary h-4 w-4" />
                    <span className="text-sm">Yes</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="no" checked={currentlyProcessCards === "no"} onChange={() => setCurrentlyProcessCards("no")} className="accent-primary h-4 w-4" />
                    <span className="text-sm">No</span>
                  </label>
                </div>
                {currentlyProcessCards === "yes" && (
                  <div className="space-y-1 pt-2">
                    <Label className="text-xs text-muted-foreground">Current Processor</Label>
                    <Input value={currentProcessor} onChange={(e) => setCurrentProcessor(e.target.value)} />
                  </div>
                )}
              </div>

              {/* Ever terminated */}
              <div className="space-y-2">
                <Label>Has the business ever been terminated by a processor?</Label>
                <div className="flex gap-4 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="yes" checked={everTerminated === "yes"} onChange={() => setEverTerminated("yes")} className="accent-primary h-4 w-4" />
                    <span className="text-sm">Yes</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="no" checked={everTerminated === "no"} onChange={() => setEverTerminated("no")} className="accent-primary h-4 w-4" />
                    <span className="text-sm">No</span>
                  </label>
                </div>
                {everTerminated === "yes" && (
                  <div className="space-y-1 pt-2">
                    <Label className="text-xs text-muted-foreground">Please explain</Label>
                    <textarea
                      rows={3}
                      className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={terminatedExplanation}
                      onChange={(e) => setTerminatedExplanation(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Payment methods */}
              <div className="space-y-2">
                <Label>Payment methods to accept</Label>
                <div className="flex flex-col gap-2 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={acceptVisa} onChange={(e) => setAcceptVisa(e.target.checked)} className="accent-primary h-4 w-4 rounded" />
                    <span className="text-sm">Visa, Mastercard, Discover</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={acceptAmex} onChange={(e) => setAcceptAmex(e.target.checked)} className="accent-primary h-4 w-4 rounded" />
                    <span className="text-sm">American Express OptBlue</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={acceptPinDebit} onChange={(e) => setAcceptPinDebit(e.target.checked)} className="accent-primary h-4 w-4 rounded" />
                    <span className="text-sm">PIN Debit</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={acceptEbt} onChange={(e) => setAcceptEbt(e.target.checked)} className="accent-primary h-4 w-4 rounded" />
                    <span className="text-sm">EBT</span>
                  </label>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={amexOptOut} onChange={(e) => setAmexOptOut(e.target.checked)} className="accent-primary h-4 w-4 rounded" />
                <span className="text-sm text-muted-foreground">Opt out of American Express marketing</span>
              </label>

              <div className="flex justify-between pt-2">
                <Button type="button" variant="outline" onClick={() => setStep(4)}>Back</Button>
                <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Next"}</Button>
              </div>
            </form>
          )}

          {/* ──────────────── STEP 6: Bank Account & Questionnaire ──────────────── */}
          {step === 6 && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const obj: Record<string, unknown> = {};
                fd.forEach((v, k) => {
                  if (v) obj[k] = v as string;
                });

                // Validate customer profile = 100%
                const cpConsumer = parseInt(String(obj.customerProfileConsumer || "0"));
                const cpBusiness = parseInt(String(obj.customerProfileBusiness || "0"));
                const cpGovernment = parseInt(String(obj.customerProfileGovernment || "0"));
                if (cpConsumer + cpBusiness + cpGovernment !== 100) {
                  toast.error("Customer Profile percentages must total 100%.");
                  return;
                }

                // Validate customer location = 100%
                const clLocal = parseInt(String(obj.customerLocationLocal || "0"));
                const clNational = parseInt(String(obj.customerLocationNational || "0"));
                const clInternational = parseInt(String(obj.customerLocationInternational || "0"));
                if (clLocal + clNational + clInternational !== 100) {
                  toast.error("Customer Location percentages must total 100%.");
                  return;
                }

                // Add controlled state values
                obj.chargedAt = chargedAt;
                obj.hasRetailLocation = hasRetailLocation;
                obj.retailLocationAddress = hasRetailLocation === "yes" ? retailLocationAddress : "";
                obj.isSeasonal = isSeasonal;
                obj.seasonalMonths = isSeasonal === "yes" ? seasonalMonths : [];

                const ok = await saveStep(obj, step + 1);
                if (ok) setStep(step + 1);
              }}
              className="space-y-6"
            >
              {/* Bank account */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Bank Account Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bankRoutingNumber">Routing Number *</Label>
                    <Input id="bankRoutingNumber" name="bankRoutingNumber" defaultValue={data.bankRoutingNumber || ""} required maxLength={9} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bankAccountNumber">Account Number *</Label>
                    <Input id="bankAccountNumber" name="bankAccountNumber" defaultValue={data.bankAccountNumber || ""} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Account Usage</Label>
                  <Select name="bankAccountUsage" defaultValue={data.bankAccountUsage || "both"}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debits">Debits Only</SelectItem>
                      <SelectItem value="deposits">Deposits Only</SelectItem>
                      <SelectItem value="both">Both Debits & Deposits</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Refund policy & equipment */}
              <div className="space-y-2">
                <Label htmlFor="refundPolicy">Refund Policy</Label>
                <textarea
                  id="refundPolicy"
                  name="refundPolicy"
                  rows={2}
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  defaultValue={data.refundPolicy || ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="equipmentUsed">Equipment Used</Label>
                <Input id="equipmentUsed" name="equipmentUsed" defaultValue={data.equipmentUsed || "DoorStax Payment Gateway"} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recurringServices">Do you offer recurring services? If yes, describe</Label>
                <textarea
                  id="recurringServices"
                  name="recurringServices"
                  rows={2}
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  defaultValue={data.recurringServices || ""}
                />
              </div>

              {/* Customer Profile */}
              <div className="space-y-2">
                <Label>Customer Profile (must total 100%)</Label>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Consumer %</Label>
                    <Input name="customerProfileConsumer" type="number" min="0" max="100" defaultValue={data.customerProfileConsumer ?? "100"} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Business %</Label>
                    <Input name="customerProfileBusiness" type="number" min="0" max="100" defaultValue={data.customerProfileBusiness ?? "0"} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Government %</Label>
                    <Input name="customerProfileGovernment" type="number" min="0" max="100" defaultValue={data.customerProfileGovernment ?? "0"} />
                  </div>
                </div>
              </div>

              {/* Customer Location */}
              <div className="space-y-2">
                <Label>Customer Location (must total 100%)</Label>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Local %</Label>
                    <Input name="customerLocationLocal" type="number" min="0" max="100" defaultValue={data.customerLocationLocal ?? "100"} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">National %</Label>
                    <Input name="customerLocationNational" type="number" min="0" max="100" defaultValue={data.customerLocationNational ?? "0"} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">International %</Label>
                    <Input name="customerLocationInternational" type="number" min="0" max="100" defaultValue={data.customerLocationInternational ?? "0"} />
                  </div>
                </div>
              </div>

              {/* Fulfillment & Delivery */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fulfillment Timing</Label>
                  <Select name="fulfillmentTiming" defaultValue={data.fulfillmentTiming || "24_hours"}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24_hours">Within 24 hours</SelectItem>
                      <SelectItem value="2_days">2 days</SelectItem>
                      <SelectItem value="3-10_days">3-10 days</SelectItem>
                      <SelectItem value="11-30_days">11-30 days</SelectItem>
                      <SelectItem value="31-90_days">31-90 days</SelectItem>
                      <SelectItem value="90+_days">90+ days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Delivery Timing</Label>
                  <Select name="deliveryTiming" defaultValue={data.deliveryTiming || "24_hours"}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24_hours">Within 24 hours</SelectItem>
                      <SelectItem value="2-5_days">2-5 days</SelectItem>
                      <SelectItem value="6-10_days">6-10 days</SelectItem>
                      <SelectItem value="11+_days">11+ days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Charged at */}
              <div className="space-y-2">
                <Label>Customer is charged at</Label>
                <div className="flex gap-4 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="time_of_order" checked={chargedAt === "time_of_order"} onChange={() => setChargedAt("time_of_order")} className="accent-primary h-4 w-4" />
                    <span className="text-sm">Time of Order</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="upon_shipment" checked={chargedAt === "upon_shipment"} onChange={() => setChargedAt("upon_shipment")} className="accent-primary h-4 w-4" />
                    <span className="text-sm">Upon Shipment</span>
                  </label>
                </div>
              </div>

              {/* Retail location */}
              <div className="space-y-2">
                <Label>Do you have a retail location?</Label>
                <div className="flex gap-4 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="yes" checked={hasRetailLocation === "yes"} onChange={() => setHasRetailLocation("yes")} className="accent-primary h-4 w-4" />
                    <span className="text-sm">Yes</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="no" checked={hasRetailLocation === "no"} onChange={() => setHasRetailLocation("no")} className="accent-primary h-4 w-4" />
                    <span className="text-sm">No</span>
                  </label>
                </div>
                {hasRetailLocation === "yes" && (
                  <div className="space-y-1 pt-2">
                    <Label className="text-xs text-muted-foreground">Retail Location Address</Label>
                    <Input value={retailLocationAddress} onChange={(e) => setRetailLocationAddress(e.target.value)} />
                  </div>
                )}
              </div>

              {/* Advertising */}
              <div className="space-y-2">
                <Label htmlFor="advertisingMethods">Advertising Methods</Label>
                <Input id="advertisingMethods" name="advertisingMethods" defaultValue={data.advertisingMethods || ""} />
              </div>

              {/* Seasonal */}
              <div className="space-y-2">
                <Label>Is the business seasonal?</Label>
                <div className="flex gap-4 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="yes" checked={isSeasonal === "yes"} onChange={() => setIsSeasonal("yes")} className="accent-primary h-4 w-4" />
                    <span className="text-sm">Yes</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="no" checked={isSeasonal === "no"} onChange={() => setIsSeasonal("no")} className="accent-primary h-4 w-4" />
                    <span className="text-sm">No</span>
                  </label>
                </div>
                {isSeasonal === "yes" && (
                  <div className="space-y-1 pt-2">
                    <Label className="text-xs text-muted-foreground">Select active months</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((month) => (
                        <label key={month} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={seasonalMonths.includes(month)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSeasonalMonths([...seasonalMonths, month]);
                              } else {
                                setSeasonalMonths(seasonalMonths.filter((m) => m !== month));
                              }
                            }}
                            className="accent-primary h-4 w-4 rounded"
                          />
                          <span className="text-sm">{month}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-2">
                <Button type="button" variant="outline" onClick={() => setStep(5)}>Back</Button>
                <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Next"}</Button>
              </div>
            </form>
          )}

          {/* ──────────────── STEP 7: Review & Submit ──────────────── */}
          {step === 7 && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <p className="text-sm text-muted-foreground mb-4">Review your application details before submitting.</p>

              {/* Step 1: Business Info */}
              <div className="space-y-3 text-sm">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Business Information</h4>
                <ReviewRow label="Business Name" value={data.businessLegalName} />
                <ReviewRow label="DBA" value={data.dba} />
                <ReviewRow label="Business Type" value={data.businessType} />
                <ReviewRow label="EIN" value={data.ein} />
                <ReviewRow label="Years in Business" value={data.yearsInBusiness} />
                {data.stockSymbol && <ReviewRow label="Stock Symbol" value={data.stockSymbol} />}
              </div>

              {/* Step 2: Contact & Location */}
              <div className="space-y-3 text-sm">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Contact & Location</h4>
                <ReviewRow label="Address" value={data.businessAddress} />
                <ReviewRow label="City, State, ZIP" value={data.businessCity && data.businessState ? `${data.businessCity}, ${data.businessState} ${data.businessZip || ""}` : undefined} />
                <ReviewRow label="Phone" value={data.businessPhone} />
                {data.faxNumber && <ReviewRow label="Fax" value={data.faxNumber} />}
                <ReviewRow label="Email" value={data.businessEmail} />
                {data.websiteUrl && <ReviewRow label="Website" value={data.websiteUrl} />}
                {data.buildingType && <ReviewRow label="Building Type" value={data.buildingType} />}
                {data.merchantOwnsOrRents && <ReviewRow label="Owns/Rents" value={data.merchantOwnsOrRents} />}
                {data.areaZoned && <ReviewRow label="Area Zoned" value={data.areaZoned} />}
                {data.squareFootage && <ReviewRow label="Square Footage" value={data.squareFootage} />}
              </div>

              {/* Step 3: Principals */}
              <div className="space-y-3 text-sm">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Principals / Owners</h4>
                {principals.map((p, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between border-b border-border pb-2">
                      <span className="text-muted-foreground">
                        {idx === 0 ? "Principal" : `Owner ${idx + 1}`}
                        {p.isManager ? " (Manager)" : ""}
                      </span>
                      <span className="text-right">
                        {p.firstName ? `${p.firstName} ${p.lastName}` : "—"}
                        {p.ownershipPercent ? ` — ${p.ownershipPercent}%` : ""}
                      </span>
                    </div>
                    {p.email && (
                      <div className="flex justify-between pl-4 text-xs">
                        <span className="text-muted-foreground">Email</span>
                        <span>{p.email}</span>
                      </div>
                    )}
                    {p.address && (
                      <div className="flex justify-between pl-4 text-xs">
                        <span className="text-muted-foreground">Address</span>
                        <span>{p.address}, {p.city} {p.state} {p.zip}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Step 4: Processing */}
              <div className="space-y-3 text-sm">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Processing Details</h4>
                <ReviewRow label="Buildings" value={data.numberOfBuildings} />
                <ReviewRow label="Total Units" value={data.numberOfUnits} />
                <ReviewRow label="Avg. Transaction" value={data.averageTransaction ? `$${data.averageTransaction}` : undefined} />
                <ReviewRow label="Max Transaction" value={data.maxTransactionAmount ? `$${data.maxTransactionAmount}` : undefined} />
                <ReviewRow label="Monthly Volume" value={data.monthlyVolume ? `$${data.monthlyVolume}` : undefined} />
                <ReviewRow label="Amex Monthly Volume" value={data.amexMonthlyVolume ? `$${data.amexMonthlyVolume}` : undefined} />
                <ReviewRow label="Product/Service" value={data.productDescription} />
                <ReviewRow label="MCC/SIC Code" value={data.mccCode} />
                <ReviewRow label="Sales: In Person" value={data.salesMethodInPerson != null ? `${data.salesMethodInPerson}%` : undefined} />
                <ReviewRow label="Sales: Mail/Phone" value={data.salesMethodMailPhone != null ? `${data.salesMethodMailPhone}%` : undefined} />
                <ReviewRow label="Sales: E-Commerce" value={data.salesMethodEcommerce != null ? `${data.salesMethodEcommerce}%` : undefined} />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Terminal IDs Needed</span>
                  <span className="font-semibold text-primary">{data.numberOfBuildings || "—"}</span>
                </div>
              </div>

              {/* Step 5: General Info */}
              <div className="space-y-3 text-sm">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">General Information</h4>
                <ReviewRow label="Bankruptcy History" value={data.bankruptcyHistory} />
                {data.bankruptcyHistory !== "never" && data.bankruptcyExplanation && (
                  <ReviewRow label="Bankruptcy Details" value={data.bankruptcyExplanation} />
                )}
                <ReviewRow label="Currently Processing Cards" value={data.currentlyProcessCards} />
                {data.currentlyProcessCards === "yes" && <ReviewRow label="Current Processor" value={data.currentProcessor} />}
                <ReviewRow label="Ever Terminated" value={data.everTerminated} />
                {data.everTerminated === "yes" && <ReviewRow label="Termination Details" value={data.terminatedExplanation} />}
                <ReviewRow label="Visa/MC/Discover" value={data.acceptVisa} />
                <ReviewRow label="Amex OptBlue" value={data.acceptAmex} />
                <ReviewRow label="PIN Debit" value={data.acceptPinDebit} />
                <ReviewRow label="EBT" value={data.acceptEbt} />
                {data.amexOptOut && <ReviewRow label="Amex Marketing Opt-Out" value={data.amexOptOut} />}
              </div>

              {/* Step 6: Bank & Questionnaire */}
              <div className="space-y-3 text-sm">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Bank Account & Questionnaire</h4>
                <ReviewRow label="Routing Number" value={data.bankRoutingNumber ? `****${data.bankRoutingNumber.slice(-4)}` : undefined} />
                <ReviewRow label="Account Number" value={data.bankAccountNumber ? `****${data.bankAccountNumber.slice(-4)}` : undefined} />
                <ReviewRow label="Account Usage" value={data.bankAccountUsage} />
                {data.refundPolicy && <ReviewRow label="Refund Policy" value={data.refundPolicy} />}
                <ReviewRow label="Equipment" value={data.equipmentUsed} />
                {data.recurringServices && <ReviewRow label="Recurring Services" value={data.recurringServices} />}
                <ReviewRow label="Customer: Consumer" value={data.customerProfileConsumer != null ? `${data.customerProfileConsumer}%` : undefined} />
                <ReviewRow label="Customer: Business" value={data.customerProfileBusiness != null ? `${data.customerProfileBusiness}%` : undefined} />
                <ReviewRow label="Customer: Government" value={data.customerProfileGovernment != null ? `${data.customerProfileGovernment}%` : undefined} />
                <ReviewRow label="Location: Local" value={data.customerLocationLocal != null ? `${data.customerLocationLocal}%` : undefined} />
                <ReviewRow label="Location: National" value={data.customerLocationNational != null ? `${data.customerLocationNational}%` : undefined} />
                <ReviewRow label="Location: International" value={data.customerLocationInternational != null ? `${data.customerLocationInternational}%` : undefined} />
                <ReviewRow label="Fulfillment Timing" value={data.fulfillmentTiming} />
                <ReviewRow label="Delivery Timing" value={data.deliveryTiming} />
                <ReviewRow label="Charged At" value={data.chargedAt} />
                <ReviewRow label="Retail Location" value={data.hasRetailLocation} />
                {data.hasRetailLocation === "yes" && <ReviewRow label="Retail Address" value={data.retailLocationAddress} />}
                {data.advertisingMethods && <ReviewRow label="Advertising Methods" value={data.advertisingMethods} />}
                <ReviewRow label="Seasonal" value={data.isSeasonal} />
                {data.isSeasonal === "yes" && data.seasonalMonths && (
                  <ReviewRow label="Active Months" value={data.seasonalMonths.join(", ")} />
                )}
              </div>

              <div className="flex justify-between pt-4">
                <Button type="button" variant="outline" onClick={() => setStep(6)}>Back</Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Submitting..." : "Submit Application"}
                </Button>
              </div>
            </form>
          )}

          {/* ──────────────── STEP 8: Sign Agreement ──────────────── */}
          {step === 8 && (
            <div className="space-y-6">
              {data.agreementSignedAt ? (
                <div className="flex flex-col items-center gap-4 py-8">
                  <CheckCircle2 className="h-16 w-16 text-green-500" />
                  <h2 className="text-xl font-semibold">Agreement Signed</h2>
                  <p className="text-center text-muted-foreground">
                    Your merchant agreement has been signed. You will be notified once your account is fully activated.
                  </p>
                  <Button onClick={() => router.push("/dashboard")}>
                    Back to Dashboard
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 py-8">
                  <Info className="h-12 w-12 text-blue-500" />
                  <h2 className="text-lg font-semibold">Application Submitted</h2>
                  <p className="text-center text-muted-foreground max-w-md">
                    Your application has been submitted. You will be notified when your agreement is ready for signature.
                  </p>
                  <div className="flex gap-2">
                    <Button onClick={() => router.push("/dashboard")}>
                      Back to Dashboard
                    </Button>
                    <Button variant="outline" onClick={() => router.push("/dashboard/properties/import")}>
                      Import Properties from CSV
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

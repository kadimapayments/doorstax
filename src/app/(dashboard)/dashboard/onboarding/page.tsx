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
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, Plus, X, Info } from "lucide-react";
import { EinInput, stripEin } from "@/components/ui/ein-input";
import { PhoneInput, stripPhone } from "@/components/ui/phone-input";
import { COMPLIANCE_WINDOW_DAYS } from "@/lib/constants";

const STEPS = [
  "Business Information",
  "Business Contact",
  "Principal / Owner",
  "Processing Details",
  "Review & Submit",
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
};

interface AppData {
  // step 1
  businessLegalName?: string;
  dba?: string;
  businessType?: string;
  ein?: string;
  // step 2
  businessAddress?: string;
  businessCity?: string;
  businessState?: string;
  businessZip?: string;
  businessPhone?: string;
  businessEmail?: string;
  websiteUrl?: string;
  // step 3 (legacy flat fields)
  principalFirstName?: string;
  principalLastName?: string;
  principalTitle?: string;
  principalDob?: string;
  principalAddress?: string;
  principalCity?: string;
  principalState?: string;
  principalZip?: string;
  ownershipPercent?: number;
  // step 3 (multi-principal)
  principals?: PrincipalData[];
  // step 4
  numberOfBuildings?: number;
  numberOfUnits?: number;
  monthlyVolume?: number;
  averageTransaction?: number;
  // meta
  currentStep?: number;
  status?: string;
  createdAt?: string;
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
            }]);
          }
          if (app.status === "SUBMITTED") {
            setStep(5);
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
    // Strip EIN formatting — send digits only to API
    if (obj.ein) obj.ein = stripEin(obj.ein);
    // Strip phone formatting — send digits only to API
    if (obj.businessPhone) obj.businessPhone = stripPhone(obj.businessPhone);
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
    const ok = await saveStep({}, 5);
    if (ok) {
      toast.success("Application submitted!");
      setStep(5);
      setData((d) => ({ ...d, status: "SUBMITTED" }));
    }
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
      <div className="flex items-center gap-2 max-w-2xl">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                i + 1 < step
                  ? "bg-green-500/20 text-green-500"
                  : i + 1 === step
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1 < step ? "✓" : i + 1}
            </div>
            <span className="hidden sm:block text-xs text-muted-foreground truncate">
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div className="h-px flex-1 bg-border" />
            )}
          </div>
        ))}
      </div>

      <Card className="max-w-2xl border-border">
        <CardHeader>
          <CardTitle className="text-base">{STEPS[step - 1]}</CardTitle>
          <CardDescription>Step {step} of {STEPS.length}</CardDescription>
        </CardHeader>
        <CardContent>
          {step === 1 && (
            <form onSubmit={handleNext} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="businessLegalName">Legal Business Name</Label>
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
                <Select name="businessType" defaultValue={data.businessType || ""}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sole_proprietor">Sole Proprietor</SelectItem>
                    <SelectItem value="llc">LLC</SelectItem>
                    <SelectItem value="corporation">Corporation</SelectItem>
                    <SelectItem value="partnership">Partnership</SelectItem>
                    <SelectItem value="nonprofit">Non-Profit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ein">EIN / Tax ID</Label>
                <EinInput id="ein" name="ein" defaultValue={data.ein || ""} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="submit" disabled={loading}>
                  {loading ? "Saving..." : "Next"}
                </Button>
              </div>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleNext} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="businessAddress">Address</Label>
                <Input id="businessAddress" name="businessAddress" defaultValue={data.businessAddress || ""} required />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="businessCity">City</Label>
                  <Input id="businessCity" name="businessCity" defaultValue={data.businessCity || ""} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessState">State</Label>
                  <Input id="businessState" name="businessState" defaultValue={data.businessState || ""} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessZip">ZIP</Label>
                  <Input id="businessZip" name="businessZip" defaultValue={data.businessZip || ""} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="businessPhone">Phone</Label>
                  <PhoneInput id="businessPhone" name="businessPhone" defaultValue={data.businessPhone || ""} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessEmail">Email</Label>
                  <Input id="businessEmail" name="businessEmail" type="email" defaultValue={data.businessEmail || ""} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="websiteUrl">Website (optional)</Label>
                <Input id="websiteUrl" name="websiteUrl" defaultValue={data.websiteUrl || ""} />
              </div>
              <div className="flex justify-between pt-2">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Next"}</Button>
              </div>
            </form>
          )}

          {step === 3 && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                // Validate: at least one principal
                if (principals.length === 0 || !principals[0].firstName || !principals[0].lastName) {
                  toast.error("At least one owner/principal is required.");
                  return;
                }
                // Validate: at least one manager
                if (!principals.some((p) => p.isManager)) {
                  toast.error("One owner must be designated as the manager.");
                  return;
                }
                // Validate: total ownership ≤ 100
                const totalOwnership = principals.reduce((sum, p) => sum + (p.ownershipPercent || 0), 0);
                if (totalOwnership > 100) {
                  toast.error("Total ownership percentage cannot exceed 100%.");
                  return;
                }
                // Save primary principal to flat fields + all to principals array
                const primary = principals[0];
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
                  principals: principals,
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
                          // If removed owner was the manager, make first one the manager
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
                      <Label>First Name</Label>
                      <Input
                        value={principal.firstName}
                        onChange={(e) => {
                          const updated = [...principals];
                          updated[idx] = { ...updated[idx], firstName: e.target.value };
                          setPrincipals(updated);
                        }}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Last Name</Label>
                      <Input
                        value={principal.lastName}
                        onChange={(e) => {
                          const updated = [...principals];
                          updated[idx] = { ...updated[idx], lastName: e.target.value };
                          setPrincipals(updated);
                        }}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        value={principal.title || ""}
                        onChange={(e) => {
                          const updated = [...principals];
                          updated[idx] = { ...updated[idx], title: e.target.value };
                          setPrincipals(updated);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Date of Birth</Label>
                      <Input
                        type="date"
                        value={principal.dob || ""}
                        onChange={(e) => {
                          const updated = [...principals];
                          updated[idx] = { ...updated[idx], dob: e.target.value };
                          setPrincipals(updated);
                        }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Home Address</Label>
                    <Input
                      value={principal.address || ""}
                      onChange={(e) => {
                        const updated = [...principals];
                        updated[idx] = { ...updated[idx], address: e.target.value };
                        setPrincipals(updated);
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>City</Label>
                      <Input
                        value={principal.city || ""}
                        onChange={(e) => {
                          const updated = [...principals];
                          updated[idx] = { ...updated[idx], city: e.target.value };
                          setPrincipals(updated);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>State</Label>
                      <Input
                        value={principal.state || ""}
                        onChange={(e) => {
                          const updated = [...principals];
                          updated[idx] = { ...updated[idx], state: e.target.value };
                          setPrincipals(updated);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>ZIP</Label>
                      <Input
                        value={principal.zip || ""}
                        onChange={(e) => {
                          const updated = [...principals];
                          updated[idx] = { ...updated[idx], zip: e.target.value };
                          setPrincipals(updated);
                        }}
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
                        onChange={(e) => {
                          const updated = [...principals];
                          updated[idx] = { ...updated[idx], ownershipPercent: e.target.value ? parseInt(e.target.value) : undefined };
                          setPrincipals(updated);
                        }}
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

          {step === 4 && (
            <form onSubmit={handleNext} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Tell us about your property portfolio so we can set up the right number of terminal IDs.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="numberOfBuildings">Number of Buildings</Label>
                  <Input id="numberOfBuildings" name="numberOfBuildings" type="number" min="1" defaultValue={data.numberOfBuildings ?? ""} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numberOfUnits">Total Units</Label>
                  <Input id="numberOfUnits" name="numberOfUnits" type="number" min="1" defaultValue={data.numberOfUnits ?? ""} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="monthlyVolume">Est. Monthly Volume ($)</Label>
                  <Input id="monthlyVolume" name="monthlyVolume" type="number" step="0.01" min="0" defaultValue={data.monthlyVolume ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="averageTransaction">Avg. Transaction ($)</Label>
                  <Input id="averageTransaction" name="averageTransaction" type="number" step="0.01" min="0" defaultValue={data.averageTransaction ?? ""} />
                </div>
              </div>
              <div className="flex justify-between pt-2">
                <Button type="button" variant="outline" onClick={() => setStep(3)}>Back</Button>
                <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Next"}</Button>
              </div>
            </form>
          )}

          {step === 5 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">Review your application details before submitting.</p>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">Business Name</span>
                  <span className="font-medium">{data.businessLegalName || "—"}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">DBA</span>
                  <span>{data.dba || "—"}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">Business Type</span>
                  <span>{data.businessType || "—"}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">Location</span>
                  <span>{data.businessCity && data.businessState ? `${data.businessCity}, ${data.businessState}` : "—"}</span>
                </div>
                {principals.map((p, idx) => (
                  <div key={idx} className="flex justify-between border-b border-border pb-2">
                    <span className="text-muted-foreground">
                      {idx === 0 ? "Principal" : `Owner ${idx + 1}`}
                      {p.isManager ? " (Manager)" : ""}
                    </span>
                    <span>
                      {p.firstName ? `${p.firstName} ${p.lastName}` : "—"}
                      {p.ownershipPercent ? ` — ${p.ownershipPercent}%` : ""}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">Buildings</span>
                  <span>{data.numberOfBuildings || "—"}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">Total Units</span>
                  <span>{data.numberOfUnits || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Terminal IDs Needed</span>
                  <span className="font-semibold text-primary">{data.numberOfBuildings || "—"}</span>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button type="button" variant="outline" onClick={() => setStep(4)}>Back</Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Submitting..." : "Submit Application"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

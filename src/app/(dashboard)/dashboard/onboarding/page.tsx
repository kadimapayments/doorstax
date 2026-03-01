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
import { CheckCircle2 } from "lucide-react";

const STEPS = [
  "Business Information",
  "Business Contact",
  "Principal / Owner",
  "Processing Details",
  "Review & Submit",
];

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
  // step 4
  numberOfBuildings?: number;
  numberOfUnits?: number;
  monthlyVolume?: number;
  averageTransaction?: number;
  // meta
  currentStep?: number;
  status?: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<AppData>({});
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    fetch("/api/boarding")
      .then((r) => r.json())
      .then((app) => {
        if (app && app.id) {
          setData(app);
          if (app.status === "SUBMITTED") {
            setStep(5);
          } else {
            setStep(app.currentStep || 1);
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
                <Input id="ein" name="ein" defaultValue={data.ein || ""} placeholder="XX-XXXXXXX" />
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
                  <Input id="businessPhone" name="businessPhone" defaultValue={data.businessPhone || ""} required />
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
            <form onSubmit={handleNext} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="principalFirstName">First Name</Label>
                  <Input id="principalFirstName" name="principalFirstName" defaultValue={data.principalFirstName || ""} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="principalLastName">Last Name</Label>
                  <Input id="principalLastName" name="principalLastName" defaultValue={data.principalLastName || ""} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="principalTitle">Title</Label>
                  <Input id="principalTitle" name="principalTitle" defaultValue={data.principalTitle || ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="principalDob">Date of Birth</Label>
                  <Input id="principalDob" name="principalDob" type="date" defaultValue={data.principalDob ? data.principalDob.toString().slice(0, 10) : ""} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="principalAddress">Home Address</Label>
                <Input id="principalAddress" name="principalAddress" defaultValue={data.principalAddress || ""} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="principalCity">City</Label>
                  <Input id="principalCity" name="principalCity" defaultValue={data.principalCity || ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="principalState">State</Label>
                  <Input id="principalState" name="principalState" defaultValue={data.principalState || ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="principalZip">ZIP</Label>
                  <Input id="principalZip" name="principalZip" defaultValue={data.principalZip || ""} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ownershipPercent">Ownership %</Label>
                <Input id="ownershipPercent" name="ownershipPercent" type="number" min="0" max="100" defaultValue={data.ownershipPercent ?? ""} />
              </div>
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
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">Principal</span>
                  <span>{data.principalFirstName ? `${data.principalFirstName} ${data.principalLastName}` : "—"}</span>
                </div>
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

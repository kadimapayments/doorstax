"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { ShieldAlert, Globe } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

interface TemplateField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
}

interface UnitInfo {
  id: string;
  unitNumber: string;
  propertyName: string;
  template: { id: string; name: string; description: string | null; fields: TemplateField[] } | null;
}

export default function ApplyPage() {
  const params = useParams<{ unitId: string }>();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [blocked, setBlocked] = useState<{ code: string; message: string } | null>(null);
  const [unit, setUnit] = useState<UnitInfo | null>(null);

  useEffect(() => {
    fetch(`/api/applications/unit-info?unitId=${params.unitId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          toast.error(data.error);
        } else {
          setUnit(data);
        }
        setFetching(false);
      })
      .catch(() => {
        toast.error("Failed to load application form");
        setFetching(false);
      });
  }, [params.unitId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const fd = new FormData(e.currentTarget);

    // Build standard fields
    const payload: Record<string, unknown> = {
      unitId: params.unitId,
      name: fd.get("name"),
      email: fd.get("email"),
      phone: fd.get("phone"),
      employment: fd.get("employment"),
      employer: fd.get("employer") || undefined,
      income: Number(fd.get("income")),
      rentalHistory: fd.get("rentalHistory") || undefined,
    };

    // Build custom template data
    if (unit?.template) {
      const customData: Record<string, string> = {};
      for (const field of unit.template.fields) {
        const val = fd.get(`custom_${field.name}`);
        if (val) customData[field.name] = val as string;
      }
      payload.customData = customData;
      payload.templateId = unit.template.id;
    }

    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.code === "VPN_DETECTED" || data.code === "GEO_BLOCKED") {
          setBlocked({ code: data.code, message: data.error });
          setLoading(false);
          return;
        }
        toast.error(data.error || "Failed to submit application");
        setLoading(false);
        return;
      }

      setSubmitted(true);
    } catch {
      toast.error("Something went wrong");
      setLoading(false);
    }
  }

  if (blocked) {
    const isVpn = blocked.code === "VPN_DETECTED";
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4">
        <Card className="w-full max-w-md border-destructive/50 text-center">
          <CardContent className="p-8">
            <div className="mb-4 flex justify-center">
              {isVpn ? (
                <ShieldAlert className="h-12 w-12 text-destructive" />
              ) : (
                <Globe className="h-12 w-12 text-destructive" />
              )}
            </div>
            <h2 className="text-xl font-bold text-destructive">
              {isVpn ? "VPN / Proxy Detected" : "US-Only Application"}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              {isVpn
                ? "We detected that you are using a VPN, proxy, or Tor connection. For security purposes, please disable your VPN and reload this page to continue."
                : "This application is currently available within the United States only. If you believe this is an error, please contact us."}
            </p>
            <div className="mt-6">
              {isVpn ? (
                <Button onClick={() => window.location.reload()} className="w-full">
                  Reload Page
                </Button>
              ) : (
                <Link href="/">
                  <Button className="w-full">Contact Us</Button>
                </Link>
              )}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Need help? Email{" "}
              <a href="mailto:support@doorstax.com" className="text-primary hover:underline">
                support@doorstax.com
              </a>
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4">
        <Card className="w-full max-w-md border-border text-center">
          <CardContent className="p-8">
            <div className="mb-4 text-4xl">&#10003;</div>
            <h2 className="text-xl font-bold">Application Submitted!</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The landlord will review your application and get back to you.
            </p>
            <Link href="/listings" className="mt-4 inline-block">
              <Button variant="outline">Back to Listings</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <div className="border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4">
          <Link href="/">
            <Image src="/logo-dark.svg" alt="DoorStax" width={130} height={30} className="dark:hidden" />
            <Image src="/logo-white.svg" alt="DoorStax" width={130} height={30} className="hidden dark:block" />
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-12">
        {fetching ? (
          <div className="text-center text-muted-foreground py-20">Loading...</div>
        ) : !unit ? (
          <Card className="border-border text-center">
            <CardContent className="p-8">
              <h2 className="text-xl font-bold">Unit Not Found</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                This unit is not accepting applications.
              </p>
              <Link href="/listings" className="mt-4 inline-block">
                <Button variant="outline">Browse Listings</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border">
            <CardHeader>
              <CardTitle>
                {unit.template ? unit.template.name : "Rental Application"}
              </CardTitle>
              <CardDescription>
                {unit.template?.description ||
                  `Apply for ${unit.propertyName} — Unit ${unit.unitNumber}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Standard fields always shown */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" name="name" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <PhoneInput id="phone" name="phone" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="employment">Employment Status</Label>
                    <Input id="employment" name="employment" placeholder="Employed, Self-employed..." required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employer">Employer (optional)</Label>
                    <Input id="employer" name="employer" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="income">Annual Income ($)</Label>
                  <Input id="income" name="income" type="number" min="0" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rentalHistory">Rental History (optional)</Label>
                  <Input id="rentalHistory" name="rentalHistory" placeholder="Previous landlord, duration..." />
                </div>

                {/* Dynamic template fields */}
                {unit.template && unit.template.fields.length > 0 && (
                  <>
                    <div className="border-t border-border pt-4">
                      <p className="text-sm font-medium text-muted-foreground mb-3">
                        Additional Information
                      </p>
                    </div>
                    {unit.template.fields.map((field) => (
                      <div key={field.name} className="space-y-2">
                        <Label htmlFor={`custom_${field.name}`}>
                          {field.label}
                          {!field.required && (
                            <span className="text-muted-foreground font-normal"> (optional)</span>
                          )}
                        </Label>
                        {field.type === "textarea" ? (
                          <textarea
                            id={`custom_${field.name}`}
                            name={`custom_${field.name}`}
                            required={field.required}
                            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        ) : field.type === "select" && field.options ? (
                          <Select name={`custom_${field.name}`}>
                            <SelectTrigger>
                              <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                            </SelectTrigger>
                            <SelectContent>
                              {field.options.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : field.type === "phone" ? (
                          <PhoneInput
                            id={`custom_${field.name}`}
                            name={`custom_${field.name}`}
                            required={field.required}
                          />
                        ) : (
                          <Input
                            id={`custom_${field.name}`}
                            name={`custom_${field.name}`}
                            type={field.type}
                            required={field.required}
                          />
                        )}
                      </div>
                    ))}
                  </>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Submitting..." : "Submit Application"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}

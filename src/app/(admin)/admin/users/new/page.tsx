"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  User,
  Wrench,
  Landmark,
  FlaskConical,
  Loader2,
  Send,
  Mail,
  Link2,
} from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Role = "PM" | "LANDLORD" | "TENANT" | "VENDOR" | "OWNER" | "DEMO";

const ROLES: {
  value: Role;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    value: "PM",
    label: "Property Manager",
    description:
      "Multi-property management company. Gets the full PM dashboard, team features, merchant application, and subscription billing.",
    icon: Briefcase,
  },
  {
    value: "LANDLORD",
    label: "Landlord",
    description:
      "Single-landlord account (1–5 properties). Same dashboard as a PM, lighter onboarding. Distinct role so we can price + message differently later.",
    icon: Building2,
  },
  {
    value: "TENANT",
    label: "Tenant",
    description:
      "Rents a unit. Optionally assign a specific unit now, or leave the PM to invite them via their own flow later.",
    icon: User,
  },
  {
    value: "VENDOR",
    label: "Vendor",
    description:
      "Service vendor (plumber, electrician, cleaner, etc.). Gets the vendor portal — tickets, invoicing, W-9 + bank.",
    icon: Wrench,
  },
  {
    value: "OWNER",
    label: "Owner / Investor",
    description:
      "Property owner receiving monthly payouts. Optionally link to a specific property — the owner inherits that property's PM.",
    icon: Landmark,
  },
  {
    value: "DEMO",
    label: "Demo PM",
    description:
      "Sandbox PM account for sales Zooms. Stored as role=PM with isDemo=true. Skips billing + compliance timer. Dashboard shows a DEMO banner.",
    icon: FlaskConical,
  },
];

export default function AddUserPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("PM");
  const [mode, setMode] = useState<"credentials" | "setup-link">("credentials");
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [unitId, setUnitId] = useState("");
  const [propertyId, setPropertyId] = useState("");

  const roleMeta = ROLES.find((r) => r.value === role)!;
  const supportsModes = role === "PM" || role === "LANDLORD" || role === "DEMO";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !name.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          companyName: companyName.trim() || undefined,
          mode: supportsModes ? mode : undefined,
          isDemo: role === "DEMO",
          unitId: role === "TENANT" && unitId ? unitId.trim() : undefined,
          propertyId: role === "OWNER" && propertyId ? propertyId.trim() : undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        if (body.setupLinkSent) {
          toast.success(`Setup link emailed to ${email}`);
        } else {
          toast.success(`Account created — credentials emailed to ${email}`);
        }
        router.push("/admin");
      } else {
        toast.error(body.error || "Failed to create user");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 page-enter">
      <Link
        href="/admin"
        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to admin
      </Link>

      <PageHeader
        title="Add User"
        description="Create a PM, landlord, tenant, vendor, owner, or demo account. Credentials or a setup link are emailed automatically."
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Role picker */}
        <Card>
          <CardContent className="p-5 space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Account type
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              {ROLES.map((r) => {
                const Icon = r.icon;
                const active = role === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    className={
                      "text-left rounded-lg border p-3 transition-colors " +
                      (active
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/40")
                    }
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={
                          "h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 " +
                          (active ? "bg-primary/20" : "bg-muted")
                        }
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{r.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                          {r.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Core fields */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium">Full name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Jane Smith"
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Email *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="jane@example.com"
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium">
                  Phone{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="4155551234"
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              {(role === "PM" || role === "LANDLORD" || role === "DEMO" || role === "VENDOR" || role === "OWNER") && (
                <div>
                  <label className="text-xs font-medium">
                    Company name{" "}
                    <span className="text-muted-foreground">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Acme Properties LLC"
                    className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}
            </div>

            {/* Role-specific fields */}
            {role === "TENANT" && (
              <div>
                <label className="text-xs font-medium">
                  Unit ID{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </label>
                <input
                  type="text"
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                  placeholder="cl…"
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  If provided, creates a TenantProfile linked to this unit. Otherwise the tenant is created bare and a PM can invite them later.
                </p>
              </div>
            )}

            {role === "OWNER" && (
              <div>
                <label className="text-xs font-medium">
                  Property ID{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </label>
                <input
                  type="text"
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                  placeholder="cl…"
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Links the owner to this property (inheriting the property&apos;s PM). Otherwise the User is created with role=OWNER and a PM can link them later.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Creation mode (PM / LANDLORD / DEMO only) */}
        {supportsModes && (
          <Card>
            <CardContent className="p-5 space-y-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                How should they get in?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode("credentials")}
                  className={
                    "text-left rounded-lg border p-3 transition-colors " +
                    (mode === "credentials"
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/40")
                  }
                >
                  <div className="flex items-start gap-3">
                    <Mail className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        Email credentials now
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Generates a temp password, emails it immediately. Best for Zoom calls.
                      </p>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("setup-link")}
                  className={
                    "text-left rounded-lg border p-3 transition-colors " +
                    (mode === "setup-link"
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/40")
                  }
                >
                  <div className="flex items-start gap-3">
                    <Link2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">Send setup link</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Emails a one-time link. They set their own password + accept TOS. 7-day expiry.
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-2">
          <Link
            href="/admin"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="btn-press rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Create {roleMeta.label}
          </button>
        </div>
      </form>
    </div>
  );
}

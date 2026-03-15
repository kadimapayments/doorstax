"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, Copy, Check } from "lucide-react";
import { ADMIN_ROLE_LABELS } from "@/lib/admin-permissions";
import type { AdminRole } from "@prisma/client";

const ROLES: AdminRole[] = [
  "OPERATIONS_MANAGER",
  "FINANCE_MANAGER",
  "SUPPORT_AGENT",
  "VIEWER",
  "SUPER_ADMIN",
];

export function AddStaffForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ id: string; generatedPassword?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      phone: (formData.get("phone") as string) || undefined,
      password: (formData.get("password") as string) || undefined,
      adminRole: formData.get("adminRole") as string,
    };

    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || "Failed to create staff member");
        setLoading(false);
        return;
      }

      setSuccess(result);
      if (!result.generatedPassword) {
        setTimeout(() => router.push("/admin/staff"), 1500);
      }
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  async function copyPassword() {
    if (success?.generatedPassword) {
      await navigator.clipboard.writeText(success.generatedPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (success) {
    return (
      <Card className="max-w-lg">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2 text-emerald-500">
            <Check className="h-5 w-5" />
            <p className="font-medium">Staff member created successfully!</p>
          </div>
          {success.generatedPassword && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                An auto-generated password was created. Share this with the staff member:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono">
                  {success.generatedPassword}
                </code>
                <Button variant="outline" size="sm" onClick={copyPassword}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
          <Button onClick={() => router.push("/admin/staff")} className="w-full">
            Back to Staff
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>New Staff Member</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" name="name" required placeholder="Full name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input id="email" name="email" type="email" required placeholder="email@example.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <PhoneInput id="phone" name="phone" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="text" placeholder="Leave empty to auto-generate" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="adminRole">Role *</Label>
            <select
              id="adminRole"
              name="adminRole"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              defaultValue="VIEWER"
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {ADMIN_ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            <UserPlus className="mr-2 h-4 w-4" />
            {loading ? "Creating..." : "Create Staff Member"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

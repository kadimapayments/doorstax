"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, UserPlus, Copy, Check } from "lucide-react";
import Link from "next/link";

export function AddLandlordForm() {
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
      phone: formData.get("phone") as string || undefined,
      password: formData.get("password") as string || undefined,
      companyName: formData.get("companyName") as string || undefined,
    };

    try {
      const res = await fetch("/api/admin/landlords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || "Failed to create landlord");
        setLoading(false);
        return;
      }

      setSuccess(result);
      // Redirect after a delay so the user can see/copy the generated password
      if (!result.generatedPassword) {
        setTimeout(() => router.push("/admin/landlords"), 1500);
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
            <p className="font-medium">Manager created successfully!</p>
          </div>
          {success.generatedPassword && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                An auto-generated password was created. Share this with the manager:
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
          <Button onClick={() => router.push("/admin/landlords")} className="w-full">
            Back to Managers
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>New Manager</CardTitle>
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
            <Label htmlFor="companyName">Company Name</Label>
            <Input id="companyName" name="companyName" placeholder="Optional company name" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            <UserPlus className="mr-2 h-4 w-4" />
            {loading ? "Creating..." : "Create Manager"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function InviteAcceptPage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/tenants/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: params.token,
          name: formData.get("name"),
          password,
          phone: formData.get("phone") || undefined,
        }),
      });

      if (!res.ok) {
        let message = "Failed to accept invitation";
        try {
          const data = await res.json();
          message = data.error || message;
        } catch {
          // Non-JSON error response (e.g., server error page)
          message = `Server error (${res.status}). Please try again.`;
        }
        setError(message);
        setLoading(false);
        return;
      }

      // Auto-login the newly created tenant
      const acceptData = await res.json();
      const loginResult = await signIn("credentials", {
        email: acceptData.email,
        password,
        redirect: false,
      });

      if (loginResult?.ok) {
        setSuccess(true);
        // Force Next.js to re-read the session cookie set by signIn
        router.refresh();
        setTimeout(() => {
          router.push("/tenant-onboarding");
          router.refresh();
        }, 1000);
      } else {
        // Fallback: redirect to login if auto-login fails
        setSuccess(true);
        setTimeout(() => router.push("/login"), 1500);
      }
    } catch (err) {
      console.error("[invite-accept]", err);
      setError("Something went wrong. Please try again or contact support.");
      setLoading(false);
    }
  }

  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md border-border text-center">
          <CardContent className="p-8">
            <div className="mb-4 text-4xl">&#10003;</div>
            <h2 className="text-xl font-bold">Welcome to DoorStax!</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your account has been created. Setting up your portal...
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="text-center">
          <CardTitle className="flex justify-center">
            <Image src="/logo-dark.svg" alt="DoorStax" width={160} height={36} priority className="dark:hidden" />
            <Image src="/logo-white.svg" alt="DoorStax" width={160} height={36} priority className="hidden dark:block" />
          </CardTitle>
          <CardDescription>
            You&apos;ve been invited as a tenant. Set up your account below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" name="name" required autoComplete="name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input id="phone" name="phone" type="tel" autoComplete="tel" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                minLength={8}
                required
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                minLength={8}
                required
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Accept & Create Account"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

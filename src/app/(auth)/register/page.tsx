"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, UserPlus } from "lucide-react";
import { PhoneInput, stripPhone } from "@/components/ui/phone-input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const refCode = searchParams.get("ref");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [phone, setPhone] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      setLoading(false);
      return;
    }

    const strippedPhone = stripPhone(phone);
    if (strippedPhone.length < 10) {
      setError("Please enter a valid 10-digit phone number");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          phone: strippedPhone,
          role: "PM",
          tosAccepted: true,
          ...(inviteToken ? { inviteToken } : {}),
          ...(refCode ? { refCode } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }

      // Auto-login and go straight to the merchant application
      const signInResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (signInResult?.error) {
        setError("Account created but auto-login failed. Please sign in manually.");
        router.push("/login");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Home
        </Link>
      <Card className="w-full border-border">
        <CardHeader className="text-center">
          <CardTitle className="flex justify-center">
            <Image src="/logo-dark.svg" alt="DoorStax" width={160} height={36} priority className="dark:hidden" />
            <Image src="/logo-white.svg" alt="DoorStax" width={160} height={36} priority className="hidden dark:block" />
          </CardTitle>
          <CardDescription>
            {inviteToken ? "You've been invited as an agent" : "Create your manager account"}
          </CardDescription>
          {inviteToken && (
            <div className="mt-2 flex items-center justify-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <UserPlus className="h-3 w-3" />
              Agent Invite
            </div>
          )}
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
              <Input
                id="name"
                name="name"
                placeholder="John Doe"
                required
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <PhoneInput
                id="phone"
                name="phone"
                value={phone}
                onValueChange={setPhone}
                required
                autoComplete="tel"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="••••••••"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="tosAccept"
                checked={tosAccepted}
                onChange={(e) => setTosAccepted(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-border"
              />
              <label htmlFor="tosAccept" className="text-sm text-muted-foreground">
                I agree to the{" "}
                <Link href="/terms" target="_blank" className="text-secondary hover:underline">
                  Terms of Service
                </Link>
                ,{" "}
                <Link href="/privacy" target="_blank" className="text-secondary hover:underline">
                  Privacy Policy
                </Link>
                ,{" "}
                <Link href="/cookie" target="_blank" className="text-secondary hover:underline">
                  Cookie Policy
                </Link>
                , and{" "}
                <Link
                  href="/merchant-agreement"
                  target="_blank"
                  className="text-secondary hover:underline"
                >
                  Merchant Agreement
                </Link>
              </label>
            </div>
            <Button type="submit" className="w-full" disabled={loading || !tosAccepted}>
              {loading ? "Creating account..." : "Create Account"}
            </Button>
          </form>
          <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              <strong>Tenants:</strong> You cannot sign up here. You will be invited by your landlord or property manager.
            </p>
          </div>
          <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 px-4 py-3">
            <p className="text-sm text-foreground">
              <strong>Service vendors?</strong>{" "}
              <Link href="/register/vendor" className="text-primary hover:underline">
                Sign up at /register/vendor
              </Link>
              {" "}to join the DoorStax directory and receive work orders from PMs.
            </p>
          </div>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-secondary hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
      </div>
    </main>
  );
}

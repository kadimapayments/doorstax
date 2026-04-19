"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
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
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

function OnboardingContent() {
  const router = useRouter();
  const search = useSearchParams();
  const token = search.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{
    email: string;
    name: string;
    role: string;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [acceptTOS, setAcceptTOS] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoadError("Missing setup token");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/admin/users/setup/${token}`);
        const body = await res.json().catch(() => ({}));
        if (res.ok) {
          setUser(body.user);
        } else {
          setLoadError(body.error || "Invalid setup link");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (password.length < 8) {
      setSubmitError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setSubmitError("Passwords don't match");
      return;
    }
    if (!acceptTOS || !acceptPrivacy) {
      setSubmitError("You must accept the Terms of Service and Privacy Policy");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/setup/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, acceptTOS, acceptPrivacy }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(body.error || "Setup failed");
        setSubmitting(false);
        return;
      }
      // Auto sign-in with the password we just set.
      const signInResult = await signIn("credentials", {
        email: body.email,
        password,
        redirect: false,
      });
      if (signInResult?.error) {
        // Setup succeeded but sign-in didn't — send them to /login.
        router.push("/login");
        return;
      }
      // Route by role
      const role = user?.role;
      const target =
        role === "VENDOR"
          ? "/vendor"
          : role === "TENANT"
            ? "/tenant"
            : role === "OWNER"
              ? "/owner"
              : role === "ADMIN"
                ? "/admin"
                : "/dashboard";
      router.push(target);
      router.refresh();
    } catch {
      setSubmitError("Something went wrong");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (loadError || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md border-border">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
            <CardTitle>Link no longer valid</CardTitle>
            <CardDescription>{loadError || "Unknown error"}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Setup links expire after 7 days and can only be used once. Ask
              your admin to send a fresh one.
            </p>
            <Link href="/login" className="text-sm text-primary hover:underline">
              Go to login
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-4">
        <Card className="border-border">
          <CardHeader className="text-center">
            <CardTitle className="flex justify-center">
              <Image src="/logo-dark.svg" alt="DoorStax" width={160} height={36} priority className="dark:hidden" />
              <Image src="/logo-white.svg" alt="DoorStax" width={160} height={36} priority className="hidden dark:block" />
            </CardTitle>
            <CardDescription>
              Finish setting up your account
            </CardDescription>
            <div className="mt-2 flex items-center justify-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600">
              <CheckCircle2 className="h-3 w-3" />
              Invited as {user.role}
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {submitError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {submitError}
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">
                  Welcome, <strong className="text-foreground">{user.name}</strong> ({user.email}).
                  Choose a password and accept our terms to get started.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="••••••••"
                />
              </div>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="acceptTOS"
                  checked={acceptTOS}
                  onChange={(e) => setAcceptTOS(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-border"
                />
                <label htmlFor="acceptTOS" className="text-sm text-muted-foreground">
                  I agree to the{" "}
                  <Link href="/terms" target="_blank" className="text-secondary hover:underline">
                    Terms of Service
                  </Link>
                </label>
              </div>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="acceptPrivacy"
                  checked={acceptPrivacy}
                  onChange={(e) => setAcceptPrivacy(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-border"
                />
                <label htmlFor="acceptPrivacy" className="text-sm text-muted-foreground">
                  I agree to the{" "}
                  <Link href="/privacy" target="_blank" className="text-secondary hover:underline">
                    Privacy Policy
                  </Link>
                </label>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={submitting || !acceptTOS || !acceptPrivacy}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Finishing setup…
                  </>
                ) : (
                  "Finish setup"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function OnboardingCompletePage() {
  return (
    <Suspense>
      <OnboardingContent />
    </Suspense>
  );
}

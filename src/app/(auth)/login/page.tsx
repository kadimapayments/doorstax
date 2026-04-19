"use client";

import { Suspense, useState, useEffect } from "react";
import Image from "next/image";
import { signIn, getSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Eye, EyeOff, Shield } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // 2FA state
  const [step, setStep] = useState<"credentials" | "2fa">("credentials");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [savedEmail, setSavedEmail] = useState("");
  const [savedPassword, setSavedPassword] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("doorstax-remember-email");
    if (saved) {
      setRememberMe(true);
      // Set email input value
      const emailInput = document.getElementById("email") as HTMLInputElement;
      if (emailInput) emailInput.value = saved;
    }

    // Show session expiry notifications
    const reason = searchParams.get("reason");
    if (reason === "inactivity") {
      toast.info("You were logged out due to inactivity.");
    } else if (reason === "max-session") {
      toast.info("Your session expired. Please sign in again.");
    }

    // Clear session security state on login page
    try {
      localStorage.removeItem("doorstax-session-locked");
      localStorage.removeItem("doorstax-session-start");
      localStorage.removeItem("doorstax-last-activity");
    } catch {}
  }, [searchParams]);

  async function doSignIn(email: string, password: string, code?: string) {
    const result = await signIn("credentials", {
      email,
      password,
      twoFactorCode: code || "",
      redirect: false,
    });

    if (result?.error) {
      setError(
        code
          ? "Invalid or expired verification code"
          : "Invalid email or password"
      );
      setLoading(false);
      return;
    }

    // If there's an explicit callbackUrl, honour it
    if (callbackUrl) {
      window.location.href = callbackUrl;
      return;
    }

    // Otherwise route based on the user's role
    // Use hard redirect so the session cookie is guaranteed fresh
    const session = await getSession();
    const role = (session?.user as { role?: string })?.role;
    const dest =
      role === "ADMIN"
        ? "/admin"
        : role === "TENANT"
          ? "/tenant"
          : role === "OWNER"
            ? "/owner"
            : "/dashboard";
    window.location.href = dest;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (step === "2fa") {
      // Step 2: sign in with 2FA code
      await doSignIn(savedEmail, savedPassword, twoFactorCode);
      return;
    }

    // Step 1: credentials
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (rememberMe) {
      localStorage.setItem("doorstax-remember-email", email);
    } else {
      localStorage.removeItem("doorstax-remember-email");
    }

    // Pre-login check for 2FA
    try {
      const preRes = await fetch("/api/auth/pre-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!preRes.ok) {
        setError("Invalid email or password");
        setLoading(false);
        return;
      }

      const preData = await preRes.json();

      if (preData.requires2fa) {
        setSavedEmail(email);
        setSavedPassword(password);
        setMaskedEmail(preData.maskedEmail);
        setStep("2fa");
        setLoading(false);
        return;
      }
    } catch {
      // If pre-login fails, fall through to normal signIn
    }

    // No 2FA — sign in directly
    await doSignIn(email, password);
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
            {step === "2fa" ? "Two-factor authentication" : "Sign in to your account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "2fa" ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="text-center space-y-2">
                <Shield className="h-8 w-8 text-primary mx-auto" />
                <p className="text-sm text-muted-foreground">
                  We sent a verification code to{" "}
                  <span className="font-medium text-foreground">{maskedEmail}</span>
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="twoFactorCode">Verification Code</Label>
                <Input
                  id="twoFactorCode"
                  value={twoFactorCode}
                  onChange={(e) =>
                    setTwoFactorCode(
                      e.target.value.replace(/\D/g, "").slice(0, 6)
                    )
                  }
                  placeholder="000000"
                  maxLength={6}
                  className="text-center text-2xl tracking-[0.5em]"
                  autoFocus
                  autoComplete="one-time-code"
                  inputMode="numeric"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={loading || twoFactorCode.length !== 6}
              >
                {loading ? "Verifying..." : "Verify"}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setStep("credentials");
                  setTwoFactorCode("");
                  setError("");
                }}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Back to login
              </button>
            </form>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}
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
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="rememberMe"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <Label htmlFor="rememberMe" className="text-sm text-muted-foreground cursor-pointer">
                      Remember me
                    </Label>
                  </div>
                  <Link
                    href="/forgot-password"
                    className="text-sm text-secondary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
              <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
                By signing in you accept our{" "}
                <Link href="/terms" className="text-secondary hover:underline">
                  Terms of Service
                </Link>
                ,{" "}
                <Link
                  href="/privacy"
                  className="text-secondary hover:underline"
                >
                  Privacy Policy
                </Link>
                , and{" "}
                <Link href="/cookie" className="text-secondary hover:underline">
                  Cookie Policy
                </Link>
                .
              </p>
              <p className="mt-3 text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{" "}
                <Link href="/register" className="text-secondary hover:underline">
                  Register
                </Link>
              </p>
            </>
          )}
        </CardContent>
      </Card>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
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
import { Lock, Eye, EyeOff, Loader2 } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Lock Screen                                                        */
/* ------------------------------------------------------------------ */

interface LockScreenProps {
  userEmail?: string;
  userName?: string;
  onUnlock: (password: string) => Promise<{ success: boolean; error?: string }>;
  onLogout: () => void;
}

export function LockScreen({
  userEmail,
  userName,
  onUnlock,
  onLogout,
}: LockScreenProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the password field on mount
  useEffect(() => {
    // Small delay to ensure the overlay is rendered
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim() || loading) return;

    setError("");
    setLoading(true);

    try {
      const result = await onUnlock(password);
      if (!result.success) {
        setError(result.error || "Invalid password");
        setPassword("");
        // Re-focus after error
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setPassword("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[50000] flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-4">
        <Card className="w-full border-border">
          <CardHeader className="text-center">
            <CardTitle className="flex justify-center">
              <Image
                src="/logo-dark.svg"
                alt="DoorStax"
                width={160}
                height={36}
                priority
                className="dark:hidden"
              />
              <Image
                src="/logo-white.svg"
                alt="DoorStax"
                width={160}
                height={36}
                priority
                className="hidden dark:block"
              />
            </CardTitle>
            <CardDescription className="pt-2">
              <Lock className="mx-auto mb-2 h-8 w-8 text-primary" />
              <span className="text-base font-semibold text-foreground">
                Session Locked
              </span>
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* User info */}
              {(userName || userEmail) && (
                <div className="rounded-md bg-muted p-3 text-center text-sm text-muted-foreground">
                  Signed in as{" "}
                  {userName && (
                    <span className="font-medium text-foreground">
                      {userName}
                    </span>
                  )}
                  {userName && userEmail && " "}
                  {userEmail && (
                    <span className="text-muted-foreground">
                      ({userEmail})
                    </span>
                  )}
                </div>
              )}

              <p className="text-center text-sm text-muted-foreground">
                Your session has been locked due to inactivity.
              </p>

              {/* Error */}
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {/* Password input */}
              <div className="space-y-2">
                <Label htmlFor="unlock-password">Password</Label>
                <div className="relative">
                  <Input
                    ref={inputRef}
                    id="unlock-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Unlock button */}
              <Button
                type="submit"
                className="w-full"
                disabled={loading || !password.trim()}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Unlock Session"
                )}
              </Button>

              {/* Sign out link */}
              <button
                type="button"
                onClick={onLogout}
                className="w-full text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Sign out
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Session Warning Overlay                                            */
/* ------------------------------------------------------------------ */

interface SessionWarningOverlayProps {
  secondsLeft: number;
  onStayActive: () => void;
}

export function SessionWarningOverlay({
  secondsLeft,
  onStayActive,
}: SessionWarningOverlayProps) {
  return (
    <div className="fixed inset-0 z-[49999] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Card className="w-full max-w-sm border-border mx-4">
        <CardHeader className="text-center">
          <CardTitle className="text-lg">Session Timeout</CardTitle>
          <CardDescription>
            Your session will lock in{" "}
            <span className="font-semibold text-foreground">
              {secondsLeft}
            </span>{" "}
            second{secondsLeft !== 1 ? "s" : ""} due to inactivity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onStayActive} className="w-full">
            Stay Active
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

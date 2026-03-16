"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SuspensionOverlayProps {
  appStatus: string;
}

export function SuspensionOverlay({ appStatus }: SuspensionOverlayProps) {
  if (appStatus === "SUBMITTED" || appStatus === "APPROVED") return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="mx-4 max-w-md rounded-xl border border-destructive/20 bg-card p-8 shadow-lg text-center">
        <ShieldAlert className="mx-auto h-16 w-16 text-destructive" />
        <h2 className="mt-4 text-xl font-bold">Account Suspended</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your merchant application was not completed within the required
          timeframe. Your dashboard access is restricted until the application
          is submitted.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Button asChild>
            <Link href="/dashboard/onboarding">Complete Application Now</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/settings">Account Settings</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

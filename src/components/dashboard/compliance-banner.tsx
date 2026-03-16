"use client";

import Link from "next/link";
import { ArrowRight, Clock, AlertTriangle, ShieldAlert } from "lucide-react";

interface ComplianceBannerProps {
  daysRemaining: number | null;
  hoursRemaining: number | null;
  expired: boolean;
  appStatus: string;
}

export function ComplianceBanner({
  daysRemaining,
  hoursRemaining,
  expired,
  appStatus,
}: ComplianceBannerProps) {
  if (appStatus === "SUBMITTED" || appStatus === "APPROVED") return null;

  // Determine urgency tier
  const isUrgent = daysRemaining !== null && daysRemaining <= 1;
  const isWarning = daysRemaining !== null && daysRemaining <= 3;

  const borderClass = expired || isUrgent
    ? "border-destructive/30 bg-destructive/5 hover:bg-destructive/10"
    : isWarning
    ? "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10"
    : "border-primary/30 bg-primary/5 hover:bg-primary/10";

  const iconClass = expired || isUrgent
    ? "text-destructive"
    : isWarning
    ? "text-amber-500"
    : "text-primary";

  const Icon = expired ? ShieldAlert : isUrgent ? AlertTriangle : Clock;

  // Build countdown text
  let countdownText: string;
  if (expired) {
    countdownText = "Your compliance window has expired. Complete your application to restore access.";
  } else if (isUrgent && hoursRemaining !== null) {
    countdownText = `Less than ${hoursRemaining} hour${hoursRemaining !== 1 ? "s" : ""} remaining — complete your application now to avoid suspension.`;
  } else if (daysRemaining !== null) {
    countdownText = `${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining to complete your merchant application and start accepting payments.`;
  } else {
    countdownText = "Complete your merchant application to start accepting payments from tenants.";
  }

  return (
    <Link
      href="/dashboard/onboarding"
      className={`flex items-center justify-between rounded-lg border p-4 transition-colors ${borderClass}`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconClass}`} />
        <div>
          <p className="font-semibold">
            {expired
              ? "Merchant Application Required"
              : "Complete Your Merchant Application"}
          </p>
          <p className="text-sm text-muted-foreground">{countdownText}</p>
          {!expired && daysRemaining !== null && daysRemaining > 1 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Add your properties and units during onboarding to get started faster.
            </p>
          )}
        </div>
      </div>
      <ArrowRight className={`h-5 w-5 shrink-0 ${iconClass}`} />
    </Link>
  );
}

"use client";

import Link from "next/link";
import Image from "next/image";
import {
  CreditCard,
  Building2,
  Users,
  Send,
  Check,
  ChevronRight,
  Home,
  Shield,
} from "lucide-react";

interface OnboardingOverlayProps {
  milestones: {
    merchantStarted: boolean;
    propertyAdded: boolean;
    tenantAdded: boolean;
    inviteSent: boolean;
  };
  trialDaysLeft: number | null;
}

export function OnboardingOverlay({
  milestones,
  trialDaysLeft,
}: OnboardingOverlayProps) {
  const steps = [
    {
      id: "merchant",
      label: "Start merchant application",
      description: "Set up payment processing to collect rent online.",
      href: "/dashboard/onboarding",
      icon: <CreditCard className="h-4 w-4" />,
      completed: milestones.merchantStarted,
    },
    {
      id: "property",
      label: "Add your first property",
      description: "Create a property with units to manage.",
      href: "/dashboard/properties",
      icon: <Building2 className="h-4 w-4" />,
      completed: milestones.propertyAdded,
    },
    {
      id: "tenant",
      label: "Add your first tenant",
      description: "Assign a tenant to one of your units.",
      href: "/dashboard/tenants",
      icon: <Users className="h-4 w-4" />,
      completed: milestones.tenantAdded,
    },
    {
      id: "invite",
      label: "Send a tenant invite",
      description: "Invite your tenant to set up their portal.",
      href: "/dashboard/tenants",
      icon: <Send className="h-4 w-4" />,
      completed: milestones.inviteSent,
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="absolute inset-0 z-40 flex items-start justify-center pt-12 sm:pt-20">
      {/* Semi-transparent backdrop */}
      <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px]" />

      {/* Centered card */}
      <div className="relative mx-4 w-full max-w-lg rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-2xl">
        {/* Logo */}
        <div className="flex justify-center mb-5">
          <Image
            src="/logo-dark.svg"
            alt="DoorStax"
            width={140}
            height={32}
            className="dark:hidden"
          />
          <Image
            src="/logo-white.svg"
            alt="DoorStax"
            width={140}
            height={32}
            className="hidden dark:block"
          />
        </div>

        {/* Welcome */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold tracking-tight">
            Welcome to DoorStax!
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete these steps to unlock your full dashboard.
          </p>
        </div>

        {/* Trial countdown */}
        {trialDaysLeft !== null && (
          <div
            className={
              "mb-5 rounded-lg px-4 py-2.5 text-center text-sm font-medium " +
              (trialDaysLeft <= 2
                ? "bg-red-500/10 text-red-600 dark:text-red-400"
                : trialDaysLeft <= 5
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "bg-primary/10 text-primary")
            }
          >
            {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} left in your
            free trial
          </div>
        )}

        {/* Progress bar */}
        <div className="flex items-center gap-3 mb-5">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            {completedCount}/{steps.length}
          </span>
        </div>

        {/* Checklist */}
        <div className="space-y-1">
          {steps.map((step) => (
            <Link
              key={step.id}
              href={step.href}
              className={
                "flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors " +
                (step.completed
                  ? "text-muted-foreground"
                  : "hover:bg-primary/5")
              }
            >
              <div
                className={
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full " +
                  (step.completed
                    ? "bg-primary text-primary-foreground"
                    : "border-2 border-muted-foreground/30")
                }
              >
                {step.completed ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  step.icon
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span
                  className={
                    "font-medium " + (step.completed ? "line-through" : "")
                  }
                >
                  {step.label}
                </span>
                {!step.completed && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {step.description}
                  </p>
                )}
              </div>
              {!step.completed && (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </Link>
          ))}
        </div>

        {/* Merchant callout */}
        {!milestones.merchantStarted && (
          <div className="mt-5 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
            <div className="flex items-start gap-2">
              <Shield className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-blue-700 dark:text-blue-400">
                  Merchant application recommended
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Complete your merchant application to start collecting rent
                  payments online.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

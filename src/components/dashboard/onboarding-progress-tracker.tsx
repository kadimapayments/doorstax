"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2,
  CreditCard,
  Users,
  Send,
  Check,
  ChevronRight,
  Shield,
  Sparkles,
} from "lucide-react";

export interface OnboardingProgressProps {
  completed: number;
  total: number;
  milestones: {
    merchantStarted: boolean;
    propertyAdded: boolean;
    tenantAdded: boolean;
    inviteSent: boolean;
    complete: boolean;
    completedAt: Date | null;
  };
}

interface MilestoneStep {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  completed: boolean;
}

export function OnboardingProgressTracker({
  completed,
  total,
  milestones,
}: OnboardingProgressProps) {
  // Don't render if onboarding is complete
  if (milestones.complete) return null;

  const steps: MilestoneStep[] = [
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
      description: "Create a tenant and assign them to a unit.",
      href: "/dashboard/tenants",
      icon: <Users className="h-4 w-4" />,
      completed: milestones.tenantAdded,
    },
    {
      id: "invite",
      label: "Send a tenant invite",
      description: "Invite your tenant so they can set up their account.",
      href: "/dashboard/tenants",
      icon: <Send className="h-4 w-4" />,
      completed: milestones.inviteSent,
    },
  ];

  const allDone = completed === total;
  const progressPercent = Math.round((completed / total) * 100);

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {allDone ? (
            <Sparkles className="h-5 w-5 text-primary" />
          ) : (
            <Shield className="h-5 w-5 text-primary" />
          )}
          <CardTitle className="text-base">
            {allDone
              ? "You're all set!"
              : "Complete Setup to Unlock Full Access"}
          </CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          {allDone
            ? "All onboarding steps are complete. The full app is now unlocked!"
            : "Complete these steps to unlock all DoorStax features. Some areas are locked until setup is finished."}
        </p>
        {/* Progress bar */}
        <div className="mt-2 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-primary/10">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            {completed}/{total}
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1">
          {steps.map((step) => (
            <Link
              key={step.id}
              href={step.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                step.completed
                  ? "text-muted-foreground"
                  : "hover:bg-primary/10"
              }`}
            >
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                  step.completed
                    ? "bg-primary text-primary-foreground"
                    : "border-2 border-muted-foreground/30"
                }`}
              >
                {step.completed ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  step.icon
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span
                  className={`font-medium ${
                    step.completed ? "line-through" : ""
                  }`}
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
      </CardContent>
    </Card>
  );
}

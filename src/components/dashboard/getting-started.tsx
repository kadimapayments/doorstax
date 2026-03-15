"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Home,
  CreditCard,
  Users,
  FileText,
  Check,
  X,
  ChevronRight,
  Rocket,
} from "lucide-react";

interface GettingStartedProps {
  propertyCount: number;
  unitCount: number;
  tenantCount: number;
  leaseCount: number;
  hasMerchantApp: boolean;
  hasCardOnFile: boolean;
}

interface Step {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  completed: boolean;
}

const DISMISS_KEY = "doorstax-getting-started-dismissed";

export function GettingStarted({
  propertyCount,
  unitCount,
  tenantCount,
  leaseCount,
  hasMerchantApp,
  hasCardOnFile,
}: GettingStartedProps) {
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash

  useEffect(() => {
    const stored = localStorage.getItem(DISMISS_KEY);
    setDismissed(stored === "true");
  }, []);

  function handleDismiss() {
    setDismissed(true);
    localStorage.setItem(DISMISS_KEY, "true");
  }

  const steps: Step[] = [
    {
      id: "property",
      label: "Add your first property",
      description: "Create a property to start managing units and tenants.",
      href: "/dashboard/properties/new",
      icon: <Building2 className="h-4 w-4" />,
      completed: propertyCount > 0,
    },
    {
      id: "units",
      label: "Add units to your property",
      description: "Define rental units with rent amounts and details.",
      href: "/dashboard/properties",
      icon: <Home className="h-4 w-4" />,
      completed: unitCount > 0,
    },
    {
      id: "merchant",
      label: "Complete merchant application",
      description: "Set up payment processing to collect rent online.",
      href: "/dashboard/onboarding",
      icon: <CreditCard className="h-4 w-4" />,
      completed: hasMerchantApp,
    },
    {
      id: "payment-method",
      label: "Add payment method",
      description: "Add a credit card for subscription billing after your free trial.",
      href: "/dashboard/settings/billing",
      icon: <CreditCard className="h-4 w-4" />,
      completed: hasCardOnFile,
    },
    {
      id: "tenant",
      label: "Add your first tenant",
      description: "Create a tenant and assign them to a unit.",
      href: "/dashboard/tenants/add",
      icon: <Users className="h-4 w-4" />,
      completed: tenantCount > 0,
    },
    {
      id: "lease",
      label: "Create a lease agreement",
      description: "Set lease terms, dates, and upload documents.",
      href: "/dashboard/leases/new",
      icon: <FileText className="h-4 w-4" />,
      completed: leaseCount > 0,
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const allComplete = completedCount === steps.length;

  // Don't show if dismissed or all steps are complete
  if (dismissed || allComplete) return null;

  const progressPercent = Math.round((completedCount / steps.length) * 100);

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Getting Started</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Dismiss</span>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Complete these steps to get the most out of DoorStax.
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
            {completedCount}/{steps.length}
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

"use client";

import Link from "next/link";
import Image from "next/image";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SuspendedGateProps {
  reason: "SUSPENDED" | "CANCELLED";
}

export function SuspendedGate({ reason }: SuspendedGateProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm">
      <div className="mx-4 max-w-md rounded-2xl border border-destructive/20 bg-card p-8 shadow-2xl text-center">
        <div className="flex justify-center mb-4">
          <Image
            src="/logo-dark.svg"
            alt="DoorStax"
            width={120}
            height={28}
            className="dark:hidden"
          />
          <Image
            src="/logo-white.svg"
            alt="DoorStax"
            width={120}
            height={28}
            className="hidden dark:block"
          />
        </div>
        <ShieldAlert className="mx-auto h-14 w-14 text-destructive" />
        <h2 className="mt-4 text-xl font-bold">
          {reason === "CANCELLED"
            ? "Account Cancelled"
            : "Account Suspended"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {reason === "CANCELLED"
            ? "Your subscription has been cancelled. Contact support to reactivate your account."
            : "Your subscription payment could not be processed. Please update your payment method to restore access."}
        </p>
        <div className="mt-6 flex flex-col gap-3">
          {reason !== "CANCELLED" && (
            <Button asChild>
              <Link href="/dashboard/settings/billing">
                Update Payment Method
              </Link>
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href="/dashboard/settings">
              {reason === "CANCELLED" ? "Contact Support" : "Account Settings"}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

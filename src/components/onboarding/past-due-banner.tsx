"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PastDueBanner() {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 sm:p-4 mb-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
          <span className="text-sm font-medium text-red-700 dark:text-red-400">
            Payment failed. Please update your payment method to avoid service
            interruption.
          </span>
        </div>
        <Button
          size="sm"
          variant="destructive"
          asChild
          className="whitespace-nowrap"
        >
          <Link href="/dashboard/settings/billing">Update Payment</Link>
        </Button>
      </div>
    </div>
  );
}

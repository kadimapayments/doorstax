"use client";

import Link from "next/link";
import { Lock, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EARNINGS_UNLOCK_UNITS } from "@/lib/constants";

interface LockedEarningsProps {
  unitCount: number;
}

export function LockedEarnings({ unitCount }: LockedEarningsProps) {
  const progress = Math.min(100, Math.round((unitCount / EARNINGS_UNLOCK_UNITS) * 100));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Earnings"
        description="Revenue from ACH and card processing through DoorStax."
      />

      <Card className="max-w-2xl border-border">
        <CardContent className="flex flex-col items-center gap-5 py-14 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>

          <div>
            <h2 className="text-xl font-bold">Earnings Unlock at {EARNINGS_UNLOCK_UNITS} Units</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Payment monetization activates once your portfolio reaches {EARNINGS_UNLOCK_UNITS} units.
              Management fees are always available regardless of unit count.
            </p>
          </div>

          {/* Progress bar */}
          <div className="w-full max-w-xs space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{unitCount} unit{unitCount !== 1 ? "s" : ""}</span>
              <span>{EARNINGS_UNLOCK_UNITS} units</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{progress}% to unlock</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              PMs set management fees independently. Payment monetization is platform-controlled.
            </p>
          </div>

          <Button asChild>
            <Link href="/dashboard/properties" className="inline-flex items-center gap-2">
              Add Properties to Grow Your Portfolio
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

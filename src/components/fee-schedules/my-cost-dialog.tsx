"use client";

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  getTier,
  getNextTier,
  calculateTieredPrice,
  getPerUnitCost,
  RESIDUAL_TIERS,
} from "@/lib/residual-tiers";
import { DollarSign, TrendingDown, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export function MyCostDialog({ unitCount }: { unitCount: number }) {
  const tier = getTier(unitCount);
  const nextTier = getNextTier(unitCount);
  const perUnitCost = getPerUnitCost(unitCount);
  const totalCost = calculateTieredPrice(unitCount);

  const unitsNeeded = nextTier ? nextTier.minUnits - unitCount : 0;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="border-purple-400 text-purple-700 hover:bg-purple-50 dark:border-purple-500 dark:text-purple-300 dark:hover:bg-purple-950"
        >
          <DollarSign className="mr-2 h-4 w-4" />
          My Cost
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Your Platform Cost</DialogTitle>
          <DialogDescription>
            Your current DoorStax subscription breakdown
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold">{unitCount.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Your Doors</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold gradient-text">{tier.name}</p>
              <p className="text-xs text-muted-foreground">Your Tier</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold">${perUnitCost.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Per-Unit Cost/mo</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                ${totalCost.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Monthly Platform Cost</p>
            </div>
          </div>

          {/* Tier ladder */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Discount Tiers
            </p>
            {RESIDUAL_TIERS.map((t) => {
              const isCurrent = tier.name === t.name;
              return (
                <div
                  key={t.name}
                  className={cn(
                    "flex items-center justify-between rounded-md px-3 py-2 text-sm",
                    isCurrent && "bg-primary/10 border border-primary/30 font-semibold",
                    !isCurrent && unitCount >= t.minUnits && "text-muted-foreground",
                    !isCurrent && unitCount < t.minUnits && "opacity-50"
                  )}
                >
                  <span>
                    {t.name}{" "}
                    <span className="text-xs text-muted-foreground font-normal">
                      ({t.maxUnits ? `${t.minUnits}-${t.maxUnits}` : `${t.minUnits}+`} units)
                    </span>
                  </span>
                  <span>${t.perUnitCost.toFixed(2)}/unit</span>
                </div>
              );
            })}
          </div>

          {/* Next tier CTA */}
          {nextTier ? (
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">Next Discount Level</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Add{" "}
                <span className="font-bold text-foreground">
                  {unitsNeeded.toLocaleString()}
                </span>{" "}
                more door{unitsNeeded !== 1 ? "s" : ""} to reach{" "}
                <span className="font-bold text-foreground">{nextTier.name}</span> and
                drop to{" "}
                <span className="font-bold text-green-600 dark:text-green-400">
                  ${nextTier.perUnitCost.toFixed(2)}/unit
                </span>
              </p>
            </div>
          ) : (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-600" />
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  You&apos;re at the best rate! Enterprise tier unlocked.
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Zap, Calendar, CreditCard } from "lucide-react";

interface VolumeInsightsProps {
  fastestGrower: { name: string; growth: number } | null;
  mostActive: { name: string; count: number } | null;
  peakDay: number | null;
  achCardSplit: { ach: number; card: number };
}

export function VolumeInsights({
  fastestGrower,
  mostActive,
  peakDay,
  achCardSplit,
}: VolumeInsightsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-emerald-500/10 p-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Fastest Growing</p>
              {fastestGrower ? (
                <>
                  <p className="truncate font-medium">{fastestGrower.name}</p>
                  <p className="text-sm text-emerald-500">+{fastestGrower.growth}% MoM</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Not enough data</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-amber-500/10 p-2">
              <Zap className="h-4 w-4 text-amber-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Most Active</p>
              {mostActive ? (
                <>
                  <p className="truncate font-medium">{mostActive.name}</p>
                  <p className="text-sm text-muted-foreground">{mostActive.count} transactions</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Not enough data</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-blue-500/10 p-2">
              <Calendar className="h-4 w-4 text-blue-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Peak Payment Day</p>
              {peakDay !== null ? (
                <p className="font-medium">Day {peakDay} of the month</p>
              ) : (
                <p className="text-sm text-muted-foreground">Not enough data</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-purple-500/10 p-2">
              <CreditCard className="h-4 w-4 text-purple-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Payment Split</p>
              <p className="font-medium">
                ACH {achCardSplit.ach}% / Card {achCardSplit.card}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

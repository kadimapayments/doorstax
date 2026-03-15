"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface VolumeComparisonProps {
  current: { month: string; ach: number; card: number; total: number; count: number };
  previous: { month: string; ach: number; card: number; total: number; count: number };
}

function pctChange(curr: number, prev: number): string {
  if (prev === 0) return curr > 0 ? "+100%" : "0%";
  const change = ((curr - prev) / prev) * 100;
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}%`;
}

function changeColor(curr: number, prev: number): string {
  if (curr > prev) return "text-emerald-500";
  if (curr < prev) return "text-red-500";
  return "text-muted-foreground";
}

export function VolumeComparison({ current, previous }: VolumeComparisonProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Month-over-Month Comparison</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Metric</th>
                <th className="pb-2 font-medium">{previous.month}</th>
                <th className="pb-2 font-medium">{current.month}</th>
                <th className="pb-2 font-medium">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="py-2 font-medium">ACH Volume</td>
                <td className="py-2">{formatCurrency(previous.ach)}</td>
                <td className="py-2">{formatCurrency(current.ach)}</td>
                <td className={`py-2 font-medium ${changeColor(current.ach, previous.ach)}`}>
                  {pctChange(current.ach, previous.ach)}
                </td>
              </tr>
              <tr>
                <td className="py-2 font-medium">Card Volume</td>
                <td className="py-2">{formatCurrency(previous.card)}</td>
                <td className="py-2">{formatCurrency(current.card)}</td>
                <td className={`py-2 font-medium ${changeColor(current.card, previous.card)}`}>
                  {pctChange(current.card, previous.card)}
                </td>
              </tr>
              <tr>
                <td className="py-2 font-medium">Total Volume</td>
                <td className="py-2">{formatCurrency(previous.total)}</td>
                <td className="py-2 font-semibold">{formatCurrency(current.total)}</td>
                <td className={`py-2 font-medium ${changeColor(current.total, previous.total)}`}>
                  {pctChange(current.total, previous.total)}
                </td>
              </tr>
              <tr>
                <td className="py-2 font-medium">Transactions</td>
                <td className="py-2">{previous.count}</td>
                <td className="py-2">{current.count}</td>
                <td className={`py-2 font-medium ${changeColor(current.count, previous.count)}`}>
                  {pctChange(current.count, previous.count)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

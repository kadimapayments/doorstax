"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

/**
 * 6-month rent-collected bar chart for the PM dashboard. Client component
 * because recharts requires the browser. Expects pre-aggregated data from
 * the server — one entry per month, `month: "Jan 2026"`, `collected: 12345`.
 */
export function RevenueChart({
  data,
}: {
  data: Array<{ month: string; collected: number }>;
}) {
  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 8, bottom: 4, left: -12 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            opacity={0.08}
            vertical={false}
          />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "currentColor", opacity: 0.6 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "currentColor", opacity: 0.6 }}
            tickFormatter={(v: number) =>
              v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`
            }
          />
          <Tooltip
            cursor={{ fill: "currentColor", opacity: 0.04 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0];
              return (
                <div className="rounded-lg border bg-card p-2 text-xs shadow-md">
                  <p className="font-medium text-foreground">
                    {p.payload.month}
                  </p>
                  <p className="text-emerald-500 font-semibold">
                    {formatCurrency(Number(p.value))}
                  </p>
                </div>
              );
            }}
          />
          <Bar
            dataKey="collected"
            fill="#10b981"
            radius={[6, 6, 0, 0]}
            maxBarSize={48}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

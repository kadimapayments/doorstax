"use client";

import { useState, useMemo } from "react";
import { MetricCard } from "@/components/ui/metric-card";
import { formatCurrency } from "@/lib/utils";
import { DollarSign, TrendingUp, CreditCard, Landmark } from "lucide-react";
import { VolumeTable, type MonthRow } from "@/components/admin/volume-table";
import { VolumeInsights } from "@/components/admin/volume-insights";
import { VolumeComparison } from "@/components/admin/volume-comparison";

interface PaymentData {
  amount: number;
  paymentMethod: string | null;
  paidAt: string | null;
  createdAt: string;
  landlordId: string;
  unitId: string;
}

interface VolumeFilterWrapperProps {
  payments: PaymentData[];
  landlords: { id: string; name: string }[];
  unitPropertyMap: Record<string, string>;
}

export function VolumeFilterWrapper({
  payments,
  landlords,
  unitPropertyMap,
}: VolumeFilterWrapperProps) {
  const [landlordFilter, setLandlordFilter] = useState("ALL");

  const filtered = useMemo(() => {
    if (landlordFilter === "ALL") return payments;
    return payments.filter((p) => p.landlordId === landlordFilter);
  }, [payments, landlordFilter]);

  // Aggregate by month
  const monthMap = useMemo(() => {
    const map = new Map<string, { ach: number; card: number; count: number }>();
    for (const p of filtered) {
      const d = new Date(p.paidAt ?? p.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const entry = map.get(key) ?? { ach: 0, card: 0, count: 0 };
      if (p.paymentMethod === "card") {
        entry.card += p.amount;
      } else {
        entry.ach += p.amount;
      }
      entry.count += 1;
      map.set(key, entry);
    }
    return map;
  }, [filtered]);

  const rows: MonthRow[] = Array.from(monthMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, data]) => ({
      month,
      ach: data.ach,
      card: data.card,
      total: data.ach + data.card,
      count: data.count,
    }));

  const totalVolume = filtered.reduce((s, p) => s + p.amount, 0);
  const achVolume = filtered
    .filter((p) => p.paymentMethod !== "card")
    .reduce((s, p) => s + p.amount, 0);
  const cardVolume = filtered
    .filter((p) => p.paymentMethod === "card")
    .reduce((s, p) => s + p.amount, 0);

  // Insights
  const now = new Date();
  const curMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

  const landlordMonthly = useMemo(() => {
    const map = new Map<string, { current: number; previous: number }>();
    for (const p of filtered) {
      const d = new Date(p.paidAt ?? p.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (key !== curMonthKey && key !== prevMonthKey) continue;
      const entry = map.get(p.landlordId) ?? { current: 0, previous: 0 };
      if (key === curMonthKey) {
        entry.current += p.amount;
      } else {
        entry.previous += p.amount;
      }
      map.set(p.landlordId, entry);
    }
    return map;
  }, [filtered, curMonthKey, prevMonthKey]);

  const landlordNameMap = useMemo(
    () => new Map(landlords.map((l) => [l.id, l.name])),
    [landlords]
  );

  let fastestGrower: { name: string; growth: number } | null = null;
  let maxGrowth = -Infinity;
  for (const [lid, data] of landlordMonthly) {
    if (data.previous > 0) {
      const growth = ((data.current - data.previous) / data.previous) * 100;
      if (growth > maxGrowth) {
        maxGrowth = growth;
        fastestGrower = {
          name: landlordNameMap.get(lid) ?? "Unknown",
          growth: Math.round(growth),
        };
      }
    }
  }

  // Most active property
  const unitCounts = new Map<string, number>();
  for (const p of filtered) {
    unitCounts.set(p.unitId, (unitCounts.get(p.unitId) ?? 0) + 1);
  }
  let mostActive: { name: string; count: number } | null = null;
  let maxCount = 0;
  for (const [uid, count] of unitCounts) {
    if (count > maxCount) {
      maxCount = count;
      mostActive = { name: unitPropertyMap[uid] ?? "Unknown", count };
    }
  }

  // Peak day
  const dayCounts = new Map<number, number>();
  for (const p of filtered) {
    if (p.paidAt) {
      const day = new Date(p.paidAt).getDate();
      dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
    }
  }
  let peakDay: number | null = null;
  let peakDayCount = 0;
  for (const [day, count] of dayCounts) {
    if (count > peakDayCount) {
      peakDayCount = count;
      peakDay = day;
    }
  }

  const achPct = totalVolume > 0 ? Math.round((achVolume / totalVolume) * 100) : 0;
  const cardPct = totalVolume > 0 ? 100 - achPct : 0;

  // MoM Comparison
  const curData = monthMap.get(curMonthKey) ?? { ach: 0, card: 0, count: 0 };
  const prevData = monthMap.get(prevMonthKey) ?? { ach: 0, card: 0, count: 0 };

  const currentMonth = {
    month: curMonthKey,
    ach: curData.ach,
    card: curData.card,
    total: curData.ach + curData.card,
    count: curData.count,
  };

  const previousMonth = {
    month: prevMonthKey,
    ach: prevData.ach,
    card: prevData.card,
    total: prevData.ach + prevData.card,
    count: prevData.count,
  };

  return (
    <div className="space-y-8">
      {/* Landlord Filter */}
      <div className="flex items-center gap-3">
        <select
          value={landlordFilter}
          onChange={(e) => setLandlordFilter(e.target.value)}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="ALL">All Managers</option>
          {landlords.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        {landlordFilter !== "ALL" && (
          <button
            onClick={() => setLandlordFilter("ALL")}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Clear filter
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Volume"
          value={formatCurrency(totalVolume)}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <MetricCard
          label="ACH Volume"
          value={formatCurrency(achVolume)}
          icon={<Landmark className="h-4 w-4" />}
        />
        <MetricCard
          label="Card Volume"
          value={formatCurrency(cardVolume)}
          icon={<CreditCard className="h-4 w-4" />}
        />
        <MetricCard
          label="Total Transactions"
          value={filtered.length}
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Insights</h2>
        <VolumeInsights
          fastestGrower={fastestGrower}
          mostActive={mostActive}
          peakDay={peakDay}
          achCardSplit={{ ach: achPct, card: cardPct }}
        />
      </div>

      <VolumeComparison current={currentMonth} previous={previousMonth} />

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Monthly Breakdown</h2>
        <VolumeTable rows={rows} />
      </div>
    </div>
  );
}

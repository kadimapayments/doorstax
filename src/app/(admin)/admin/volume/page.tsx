import { requireRole } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { formatCurrency } from "@/lib/utils";
import { DollarSign, TrendingUp, CreditCard, Landmark } from "lucide-react";
import { VolumeTable } from "@/components/admin/volume-table";

export const metadata = { title: "Volume Analytics — Admin" };

export default async function AdminVolumePage() {
  await requireRole("ADMIN");

  const payments = await db.payment.findMany({
    where: { status: "COMPLETED" },
    select: { amount: true, paymentMethod: true, paidAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  // Aggregate by month
  const monthMap = new Map<string, { ach: number; card: number; count: number }>();
  for (const p of payments) {
    const d = p.paidAt ?? p.createdAt;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const entry = monthMap.get(key) ?? { ach: 0, card: 0, count: 0 };
    const amt = Number(p.amount);
    if (p.paymentMethod === "card") {
      entry.card += amt;
    } else {
      entry.ach += amt;
    }
    entry.count += 1;
    monthMap.set(key, entry);
  }

  const rows = Array.from(monthMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, data]) => ({
      month,
      ach: data.ach,
      card: data.card,
      total: data.ach + data.card,
      count: data.count,
    }));

  const totalVolume = payments.reduce((s, p) => s + Number(p.amount), 0);
  const achVolume = payments
    .filter((p) => p.paymentMethod !== "card")
    .reduce((s, p) => s + Number(p.amount), 0);
  const cardVolume = payments
    .filter((p) => p.paymentMethod === "card")
    .reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-8">
      <PageHeader title="Volume Analytics" description="Payment volume across all landlords." />

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
          value={payments.length}
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Monthly Breakdown</h2>
        <VolumeTable rows={rows} />
      </div>
    </div>
  );
}

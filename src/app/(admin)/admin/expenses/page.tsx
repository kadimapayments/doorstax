export const dynamic = "force-dynamic";

import { requireAdminPermission } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { formatCurrency } from "@/lib/utils";
import { DollarSign, TrendingDown, Repeat, Receipt } from "lucide-react";
import { ExpensesTable } from "@/components/admin/expenses-table";

export const metadata = { title: "Expenses — Admin" };

export default async function AdminExpensesPage() {
  await requireAdminPermission("admin:expenses");

  const expenses = await db.expense.findMany({
    include: {
      property: { select: { name: true } },
      unit: { select: { unitNumber: true } },
      landlord: { select: { id: true, name: true } },
    },
    orderBy: { date: "desc" },
  });

  const rows = expenses.map((e) => ({
    id: e.id,
    landlordId: e.landlord.id,
    landlordName: e.landlord.name,
    property: e.property.name,
    unit: e.unit?.unitNumber ?? null,
    category: e.category,
    amount: Number(e.amount),
    date: e.date.toISOString(),
    description: e.description,
    vendor: e.vendor,
    recurring: e.recurring,
    receiptUrl: e.receiptUrl,
  }));

  const landlords = Array.from(
    new Map(rows.map((r) => [r.landlordId, r.landlordName])).entries()
  ).map(([id, name]) => ({ id, name }));

  const properties = Array.from(new Set(rows.map((r) => r.property))).sort();

  const categories = Array.from(new Set(rows.map((r) => r.category))).sort();

  const totalExpenses = rows.reduce((s, r) => s + r.amount, 0);
  const recurringTotal = rows.filter((r) => r.recurring).reduce((s, r) => s + r.amount, 0);
  const avgExpense = rows.length > 0 ? Math.round(totalExpenses / rows.length) : 0;
  const withReceipts = rows.filter((r) => r.receiptUrl).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Expenses"
        description="All landlord expenses across the platform."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Expenses"
          value={formatCurrency(totalExpenses)}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <MetricCard
          label="Avg Expense"
          value={formatCurrency(avgExpense)}
          icon={<TrendingDown className="h-4 w-4" />}
        />
        <MetricCard
          label="Recurring Total"
          value={formatCurrency(recurringTotal)}
          icon={<Repeat className="h-4 w-4" />}
        />
        <MetricCard
          label="With Receipts"
          value={`${withReceipts} / ${rows.length}`}
          icon={<Receipt className="h-4 w-4" />}
        />
      </div>

      <ExpensesTable
        rows={rows}
        landlords={landlords}
        properties={properties}
        categories={categories}
      />
    </div>
  );
}

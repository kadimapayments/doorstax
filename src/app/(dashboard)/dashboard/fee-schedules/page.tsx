"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ClipboardList, Users, Lock } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { MyCostDialog } from "@/components/fee-schedules/my-cost-dialog";
import { getTier } from "@/lib/residual-tiers";

interface FeeScheduleRow {
  id: string;
  name: string;
  managementFeePercent: number;
  achRate: number;
  payoutFeeRate: number;
  unitFeeRate: number;
  billMe: boolean;
  billMeIncludeManagement: boolean;
  payoutFrequency: string;
  deductProcessingFees: boolean;
  deductExpenses: boolean;
  deductPlatformFee: boolean;
  achFeeResponsibility?: string;
  ownerCount: number;
  createdAt: string;
}

export default function FeeSchedulesPage() {
  const [schedules, setSchedules] = useState<FeeScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [unitCount, setUnitCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/fee-schedules")
      .then((r) => r.json())
      .then((data) => {
        setSchedules(data.schedules ?? []);
        setUnitCount(data.unitCount ?? 0);
      })
      .finally(() => setLoading(false));
  }, []);

  const columns: Column<FeeScheduleRow>[] = [
    {
      key: "name",
      header: "Schedule Name",
      sortable: true,
      sortFn: (a, b) => a.name.localeCompare(b.name),
      cell: (row) => (
        <Link href={`/dashboard/fee-schedules/${row.id}`} className="font-medium text-accent-lavender hover:underline">
          {row.name}
        </Link>
      ),
    },
    {
      key: "managementFeePercent",
      header: "Mgmt Fee",
      sortable: true,
      sortFn: (a, b) => a.managementFeePercent - b.managementFeePercent,
      cell: (row) => `${row.managementFeePercent}%`,
    },
    {
      key: "achRate",
      header: "ACH Fee",
      sortable: true,
      sortFn: (a, b) => a.achRate - b.achRate,
      cell: (row) => {
        const tier = getTier(unitCount ?? 0);
        return (
          <div>
            <span className="font-medium">${row.achRate.toFixed(2)}</span>
            <span className="text-xs text-muted-foreground ml-1">
              (cost: ${tier.platformAchCost.toFixed(2)})
            </span>
          </div>
        );
      },
    },
    {
      key: "achFeeResponsibility",
      header: "ACH Pays",
      cell: (row) => {
        const mode = row.achFeeResponsibility || "OWNER";
        const label = mode === "TENANT" ? "Tenant" : mode === "PM" ? "PM" : "Owner";
        const color = mode === "TENANT" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : mode === "PM" ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" : "bg-muted text-muted-foreground";
        return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${color}`}>{label}</span>;
      },
    },
    {
      key: "payoutFeeRate",
      header: "Payout Fee",
      sortable: true,
      sortFn: (a, b) => a.payoutFeeRate - b.payoutFeeRate,
      cell: (row) => `${(row.payoutFeeRate * 100).toFixed(2)}%`,
    },
    {
      key: "unitFeeRate",
      header: "Unit Fee",
      sortable: true,
      sortFn: (a, b) => a.unitFeeRate - b.unitFeeRate,
      cell: (row) => `$${row.unitFeeRate.toFixed(2)}/unit`,
    },
    {
      key: "billMe",
      header: "Bill Me",
      cell: (row) => (
        row.billMe ? (
          <span className="rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-medium">
            Bill Me
          </span>
        ) : null
      ),
    },
    {
      key: "deductions",
      header: "Deductions",
      cell: (row) => (
        <div className="flex gap-1.5">
          {row.deductProcessingFees && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">Fees</span>}
          {row.deductExpenses && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">Expenses</span>}
          {row.deductPlatformFee && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">Platform</span>}
        </div>
      ),
    },
    {
      key: "ownerCount",
      header: "Owners",
      sortable: true,
      sortFn: (a, b) => a.ownerCount - b.ownerCount,
      cell: (row) => (
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          {row.ownerCount}
        </span>
      ),
    },
  ];

  if (loading) return <div className="text-center py-12 text-muted-foreground">Loading...</div>;

  // Locked state for < 100 units
  if (unitCount !== null && unitCount < 100) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Fee Schedules"
          description="Create and manage pricing structures for your property owners."
        />

        <div className="rounded-xl border bg-card p-8 text-center space-y-4 max-w-lg mx-auto">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Lock className="h-7 w-7 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold text-foreground">
            Fee Schedules Unlock at 100 Units
          </h2>
          <p className="text-sm text-muted-foreground">
            You&apos;re currently at <span className="font-semibold text-foreground">{unitCount}</span> units.
            Reach 100 units to customize fee schedules and monetize payments.
          </p>

          <div className="rounded-lg border bg-muted/30 p-4 text-left space-y-2 mt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Standard Rates (Applied to All Owners)
            </h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Card Convenience Fee</span>
              <span className="font-medium">3.25% (tenant pays)</span>
              <span className="text-muted-foreground">ACH Fee</span>
              <span className="font-medium">$6.00/tx</span>
              <span className="text-muted-foreground">Payout Fee</span>
              <span className="font-medium">0.15%</span>
              <span className="text-muted-foreground">Management Fee</span>
              <span className="font-medium">8%</span>
            </div>
          </div>

          <MyCostDialog unitCount={unitCount} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Fee Schedules"
          description="Create and manage pricing structures for your property owners."
        />
        <div className="flex items-center gap-2">
          {unitCount !== null && <MyCostDialog unitCount={unitCount} />}
          <Link
            href="/dashboard/fee-schedules/new"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New Schedule
          </Link>
        </div>
      </div>
      <DataTable
        columns={columns}
        data={schedules}
        emptyMessage="No fee schedules yet. Create one to standardize your pricing."
      />
    </div>
  );
}

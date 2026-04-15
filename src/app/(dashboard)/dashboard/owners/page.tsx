"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserCheck, Plus, Building2, Percent, DollarSign, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { showConfirm } from "@/components/admin/dialog-prompt";

interface Owner {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  managementFeePercent: number;
  deductProcessingFees: boolean;
  deductExpenses: boolean;
  deductPlatformFee: boolean;
  terminalId: string | null;
  achTerminalId: string | null;
  properties: { id: string; name: string }[];
  _count: { payouts: number };
  totalPaid: number;
}

export default function OwnersPage() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/owners")
      .then((r) => r.json())
      .then(setOwners)
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string, name: string) {
    if (!await showConfirm({ title: `Delete Owner "${name}"?`, description: "This will permanently remove the owner and unlink them from any properties. Historical payout records will be retained.", confirmLabel: "Delete Owner", destructive: true })) return;
    const res = await fetch(`/api/owners/${id}`, { method: "DELETE" });
    if (res.ok) {
      setOwners((prev) => prev.filter((o) => o.id !== id));
      toast.success("Owner deleted");
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to delete");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Property Owners</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage property owners and their fee configurations
          </p>
        </div>
        <Link
          href="/dashboard/owners/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add Owner
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : owners.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <UserCheck className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Owners Yet</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Add property owners to track payouts. Assign properties to each owner
            and configure management fees, processing fee deductions, and more.
          </p>
          <Link
            href="/dashboard/owners/new"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Add Your First Owner
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 font-medium">TID</th>
                <th className="px-4 py-3 font-medium">ACH TID</th>
                <th className="px-4 py-3 font-medium">Properties</th>
                <th className="px-4 py-3 font-medium">Mgmt Fee</th>
                <th className="px-4 py-3 font-medium">Deductions</th>
                <th className="px-4 py-3 font-medium text-right">Total Paid</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {owners.map((owner) => (
                <tr key={owner.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/owners/${owner.id}`} className="hover:underline">
                      <p className="font-medium text-foreground">{owner.name}</p>
                      {owner.email && <p className="text-xs text-muted-foreground">{owner.email}</p>}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-muted-foreground">
                      {owner.terminalId || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-muted-foreground">
                      {owner.achTerminalId || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5" />
                      <span>{owner.properties.length}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Percent className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">{owner.managementFeePercent}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 flex-wrap">
                      {owner.deductProcessingFees && (
                        <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">Processing</span>
                      )}
                      {owner.deductExpenses && (
                        <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-medium text-orange-600 dark:text-orange-400">Expenses</span>
                      )}
                      {owner.deductPlatformFee && (
                        <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-600 dark:text-purple-400">Platform</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {owner.totalPaid.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(owner.id, owner.name)}
                      className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete owner"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

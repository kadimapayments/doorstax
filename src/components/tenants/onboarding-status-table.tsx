"use client";

import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Loader2 } from "lucide-react";

interface OnboardingRow {
  id: string;
  inviteId: string | null;
  name: string;
  email: string;
  property: string;
  unit: string;
  status: "PENDING" | "EXPIRED" | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED";
  onboardingStep: string;
  invitedAt: string;
  acceptedAt: string | null;
}

interface Props {
  rows: OnboardingRow[];
  filter: string;
  onRefresh: () => void;
}

const statusBadge: Record<string, string> = {
  PENDING: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  EXPIRED: "bg-red-500/10 text-red-600 dark:text-red-400",
  ACCEPTED: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  IN_PROGRESS: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  COMPLETED: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

const stepLabels: Record<string, string> = {
  PERSONAL_DETAILS: "Personal Details",
  PAYMENT_METHOD: "Payment Method",
  ROOMMATES: "Roommates",
  MOVE_IN_CHECKLIST: "Move-In Checklist",
  DOCUMENTS: "Documents",
  LEASE_ACKNOWLEDGMENT: "Lease Review",
  COMPLETE: "Complete",
};

export function OnboardingStatusTable({ rows, filter, onRefresh }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [resending, setResending] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const filtered =
    filter === "ALL"
      ? rows
      : rows.filter((r) => r.status === filter);

  function toggleAll() {
    const eligible = filtered.filter(
      (r) => r.status === "PENDING" || r.status === "EXPIRED"
    );
    if (selected.size === eligible.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(eligible.map((r) => r.inviteId!).filter(Boolean)));
    }
  }

  function toggleOne(inviteId: string) {
    const next = new Set(selected);
    if (next.has(inviteId)) next.delete(inviteId);
    else next.add(inviteId);
    setSelected(next);
  }

  async function bulkResend() {
    if (selected.size === 0) return;
    setResending(true);
    try {
      const res = await fetch("/api/tenants/invite/bulk-resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteIds: [...selected] }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Re-sent ${data.resent} invite(s)`);
        setSelected(new Set());
        onRefresh();
      } else {
        toast.error(data.error || "Failed to resend");
      }
    } catch {
      toast.error("Request failed");
    } finally {
      setResending(false);
    }
  }

  async function resendOne(inviteId: string) {
    setResendingId(inviteId);
    try {
      const res = await fetch("/api/tenants/invite/bulk-resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteIds: [inviteId] }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Invite re-sent");
        onRefresh();
      } else {
        toast.error(data.error || "Failed");
      }
    } catch {
      toast.error("Request failed");
    } finally {
      setResendingId(null);
    }
  }

  const hasEligible = filtered.some(
    (r) => r.status === "PENDING" || r.status === "EXPIRED"
  );

  return (
    <div>
      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border bg-primary/5 px-4 py-2 mb-4">
          <span className="text-sm font-medium">
            {selected.size} selected
          </span>
          <button
            onClick={bulkResend}
            disabled={resending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {resending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Re-invite Selected
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              {hasEligible && (
                <th className="px-3 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={
                      selected.size > 0 &&
                      selected.size ===
                        filtered.filter(
                          (r) =>
                            r.status === "PENDING" || r.status === "EXPIRED"
                        ).length
                    }
                    onChange={toggleAll}
                    className="rounded"
                  />
                </th>
              )}
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Property / Unit</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Step</th>
              <th className="px-4 py-3 font-medium">Invited</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={hasEligible ? 8 : 7}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No tenants found for this filter.
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const canResend =
                  row.status === "PENDING" || row.status === "EXPIRED";
                return (
                  <tr
                    key={row.id}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    {hasEligible && (
                      <td className="px-3 py-3">
                        {canResend && row.inviteId && (
                          <input
                            type="checkbox"
                            checked={selected.has(row.inviteId)}
                            onChange={() => toggleOne(row.inviteId!)}
                            className="rounded"
                          />
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 font-medium">{row.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.email}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {row.property} — Unit {row.unit}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadge[row.status] || ""}`}
                      >
                        {row.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {stepLabels[row.onboardingStep] || row.onboardingStep}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(row.invitedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {canResend && row.inviteId && (
                        <button
                          onClick={() => resendOne(row.inviteId!)}
                          disabled={resendingId === row.inviteId}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
                        >
                          {resendingId === row.inviteId ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3 w-3" />
                          )}
                          Re-invite
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

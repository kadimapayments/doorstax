"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Clock,
  UserCheck,
  CheckCircle2,
} from "lucide-react";
import { OnboardingStatusTable } from "@/components/tenants/onboarding-status-table";

interface Metrics {
  totalInvited: number;
  pending: number;
  expired: number;
  inProgress: number;
  completed: number;
}

interface Row {
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

const FILTERS = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "EXPIRED", label: "Expired" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "COMPLETED", label: "Completed" },
];

export default function OnboardingDashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");

  function fetchData() {
    setLoading(true);
    fetch("/api/tenants/onboarding-status")
      .then((r) => r.json())
      .then((data) => {
        setMetrics(data.metrics);
        setRows(data.rows);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/tenants"
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Onboarding Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track tenant invite acceptance and onboarding progress
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading...
        </div>
      ) : (
        <>
          {/* Metric Cards */}
          {metrics && (
            <div className="grid grid-cols-4 gap-4">
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">
                    Total Invited
                  </span>
                </div>
                <p className="text-2xl font-bold">{metrics.totalInvited}</p>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">
                    Pending
                  </span>
                </div>
                <p className="text-2xl font-bold">
                  {metrics.pending}
                  {metrics.expired > 0 && (
                    <span className="text-sm text-red-500 ml-2">
                      ({metrics.expired} expired)
                    </span>
                  )}
                </p>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <UserCheck className="h-4 w-4 text-purple-500" />
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">
                    In Progress
                  </span>
                </div>
                <p className="text-2xl font-bold">{metrics.inProgress}</p>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">
                    Completed
                  </span>
                </div>
                <p className="text-2xl font-bold">{metrics.completed}</p>
              </div>
            </div>
          )}

          {/* Filter Bar */}
          <div className="flex items-center gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === f.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Table */}
          <OnboardingStatusTable
            rows={rows}
            filter={filter}
            onRefresh={fetchData}
          />
        </>
      )}
    </div>
  );
}

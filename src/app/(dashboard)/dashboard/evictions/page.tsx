"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { Search, AlertTriangle, Clock, Gavel, CheckCircle2, XCircle } from "lucide-react";

interface EvictionRow {
  id: string;
  status: string;
  reason: string;
  outstandingBalance: number | null;
  noticeDeadline: string | null;
  hearingDate: string | null;
  caseNumber: string | null;
  createdAt: string;
  tenantId: string;
  tenant: { id: string; user: { name: string; email: string } };
  unit: { unitNumber: string; property: { name: string } };
}

const STATUS_OPTIONS = [
  "all", "NOTICE_PENDING", "NOTICE_SERVED", "CURE_PERIOD", "FILING_PENDING",
  "FILED", "HEARING_SCHEDULED", "JUDGMENT", "WRIT_ISSUED", "COMPLETED", "CANCELLED",
];

function statusIcon(status: string) {
  if (status === "COMPLETED") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
  if (status === "CANCELLED") return <XCircle className="h-3.5 w-3.5 text-muted-foreground" />;
  if (["FILED", "HEARING_SCHEDULED", "JUDGMENT", "WRIT_ISSUED"].includes(status)) return <Gavel className="h-3.5 w-3.5 text-red-500" />;
  return <Clock className="h-3.5 w-3.5 text-amber-500" />;
}

export default function EvictionsPage() {
  const [evictions, setEvictions] = useState<EvictionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    fetch("/api/evictions?" + params.toString())
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setEvictions(Array.isArray(data) ? data : []))
      .catch(() => setEvictions([]))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const filtered = evictions.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.tenant?.user?.name?.toLowerCase().includes(q) ||
      e.unit?.property?.name?.toLowerCase().includes(q) ||
      e.unit?.unitNumber?.toLowerCase().includes(q) ||
      e.caseNumber?.toLowerCase().includes(q)
    );
  });

  const activeCount = evictions.filter((e) => !["COMPLETED", "CANCELLED"].includes(e.status)).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Evictions"
        description={activeCount > 0 ? `${activeCount} active case${activeCount !== 1 ? "s" : ""}` : "No active eviction cases"}
      />

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search tenant, property, case #..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "all" ? "All Statuses" : s.replace(/_/g, " ").charAt(0) + s.replace(/_/g, " ").slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No eviction cases found.</p>
          <p className="text-xs mt-1">Start an eviction from a tenant&apos;s unit page.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Tenant</th>
                <th className="px-4 py-2.5 font-medium">Property / Unit</th>
                <th className="px-4 py-2.5 font-medium">Reason</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Balance</th>
                <th className="px-4 py-2.5 font-medium">Next Deadline</th>
                <th className="px-4 py-2.5 font-medium">Filed</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const nextDate = e.hearingDate || e.noticeDeadline;
                const isActive = !["COMPLETED", "CANCELLED"].includes(e.status);
                return (
                  <Link key={e.id} href={`/dashboard/tenants/${e.tenant?.id || e.tenantId}`} className="contents">
                    <tr className={cn("border-b last:border-0 hover:bg-muted/50 cursor-pointer", isActive ? "" : "opacity-60")}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{e.tenant?.user?.name}</div>
                        <div className="text-xs text-muted-foreground">{e.tenant?.user?.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div>{e.unit?.property?.name}</div>
                        <div className="text-xs text-muted-foreground">Unit {e.unit?.unitNumber}</div>
                      </td>
                      <td className="px-4 py-3 capitalize text-muted-foreground">{e.reason?.replace(/_/g, " ").toLowerCase()}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {statusIcon(e.status)}
                          <span className="text-xs capitalize">{e.status?.replace(/_/g, " ").toLowerCase()}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-red-500">{e.outstandingBalance ? formatCurrency(e.outstandingBalance) : "—"}</td>
                      <td className="px-4 py-3">{nextDate ? formatDate(nextDate) : "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(e.createdAt)}</td>
                    </tr>
                  </Link>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

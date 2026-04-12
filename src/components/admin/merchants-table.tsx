"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { Search, Mail, Loader2, MoreVertical, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MerchantRow {
  id: string;
  pmId: string | null;
  pmName: string;
  pmEmail: string;
  companyName: string;
  status: string;
  currentStep: number;
  kadimaAppId: string | null;
  kadimaApplicationUrl: string | null;
  createdAt: string;
  daysUntilExpiry: number | null;
  isExpiringSoon: boolean;
  subscriptionStatus: string | null;
  trialDaysLeft: number | null;
  propertiesCount: number;
  unitsCount: number;
  propertiesWithoutTerminal: number;
}

interface Stats {
  totalPms: number;
  approved: number;
  pending: number;
  notStarted: number;
  expired: number;
}

const STATUS_CLASS: Record<string, string> = {
  NOT_STARTED: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
  IN_PROGRESS: "bg-blue-500/15 text-blue-500 border-blue-500/20",
  SUBMITTED: "bg-amber-500/15 text-amber-500 border-amber-500/20",
  APPROVED: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
  EXPIRED: "bg-red-500/15 text-red-500 border-red-500/20",
  REJECTED: "bg-red-500/15 text-red-500 border-red-500/20 line-through",
};

const STATUS_OPTIONS = [
  "ALL",
  "NOT_STARTED",
  "IN_PROGRESS",
  "SUBMITTED",
  "APPROVED",
  "EXPIRED",
  "REJECTED",
];

export function MerchantsTable() {
  const [rows, setRows] = useState<MerchantRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchData = useMemo(
    () => async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (statusFilter !== "ALL") params.set("status", statusFilter);
        if (search) params.set("search", search);
        const res = await fetch(`/api/admin/merchants?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setRows(data.rows || []);
          setStats(data.stats || null);
        }
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, search]
  );

  useEffect(() => {
    const t = setTimeout(fetchData, 200);
    return () => clearTimeout(t);
  }, [fetchData]);

  async function runAction(id: string, action: string, label: string) {
    if (action === "expire" || action === "activate") {
      if (!confirm(`Are you sure you want to ${label.toLowerCase()}?`)) return;
    }
    setActionId(id);
    try {
      const res = await fetch(`/api/admin/merchants/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(`${label} succeeded`);
        fetchData();
      } else {
        toast.error(data.error || `${label} failed`);
      }
    } catch {
      toast.error("Network error");
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatCard label="Total PMs" value={stats.totalPms} />
          <StatCard label="Approved" value={stats.approved} tone="green" />
          <StatCard label="Pending" value={stats.pending} tone="amber" />
          <StatCard
            label="Not Started"
            value={stats.notStarted}
            tone="zinc"
          />
          <StatCard label="Expired / Rejected" value={stats.expired} tone="red" />
        </div>
      )}

      {/* Filter bar */}
      <Card className="border-border">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm h-10"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "ALL" ? "All statuses" : s.replace("_", " ")}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-border">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">
              No merchant applications match these filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Manager</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Step</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Expires In</TableHead>
                    <TableHead>Subscription</TableHead>
                    <TableHead>Portfolio</TableHead>
                    <TableHead>Kadima</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() =>
                        (window.location.href = `/admin/merchants/${r.id}`)
                      }
                    >
                      <TableCell>
                        <div className="font-medium text-sm">{r.pmName}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.pmEmail}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.companyName || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            STATUS_CLASS[r.status] ||
                            "bg-zinc-500/15 text-zinc-400 border-zinc-500/20"
                          }
                        >
                          {r.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.currentStep}/5
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(r.createdAt)}
                      </TableCell>
                      <TableCell>
                        {r.daysUntilExpiry === null ? (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        ) : (
                          <span
                            className={
                              "text-xs font-medium " +
                              (r.daysUntilExpiry === 0
                                ? "text-red-500"
                                : r.daysUntilExpiry <= 7
                                  ? "text-red-500"
                                  : r.daysUntilExpiry <= 14
                                    ? "text-amber-500"
                                    : "text-muted-foreground")
                            }
                          >
                            {r.daysUntilExpiry === 0
                              ? "Today"
                              : `${r.daysUntilExpiry}d`}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          {r.subscriptionStatus || "—"}
                        </div>
                        {r.trialDaysLeft !== null && (
                          <div className="text-[10px] text-muted-foreground">
                            Trial: {r.trialDaysLeft}d
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.propertiesCount}p · {r.unitsCount}u
                        {r.propertiesWithoutTerminal > 0 && (
                          <div className="text-[10px] text-amber-500">
                            {r.propertiesWithoutTerminal} need terminal
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.kadimaAppId ? (
                          <span className="text-xs font-mono text-muted-foreground">
                            #{r.kadimaAppId}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              disabled={actionId === r.id}
                            >
                              {actionId === r.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreVertical className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {r.kadimaApplicationUrl && (
                              <DropdownMenuItem asChild>
                                <a
                                  href={r.kadimaApplicationUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                  Open Kadima Link
                                </a>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() =>
                                runAction(r.id, "resend-link", "Email link")
                              }
                            >
                              <Mail className="h-4 w-4 mr-2" />
                              Resend Link Email
                            </DropdownMenuItem>
                            {r.status !== "EXPIRED" &&
                              r.status !== "APPROVED" && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    runAction(r.id, "extend", "Extend deadline")
                                  }
                                >
                                  Extend +15 days
                                </DropdownMenuItem>
                              )}
                            {r.status !== "APPROVED" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  runAction(r.id, "activate", "Manually approve")
                                }
                              >
                                Manually Approve
                              </DropdownMenuItem>
                            )}
                            {r.status !== "EXPIRED" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  runAction(r.id, "expire", "Expire now")
                                }
                                className="text-red-500"
                              >
                                Expire Now
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "green" | "amber" | "red" | "zinc";
}) {
  const valueColor =
    tone === "green"
      ? "text-emerald-500"
      : tone === "amber"
        ? "text-amber-500"
        : tone === "red"
          ? "text-red-500"
          : tone === "zinc"
            ? "text-muted-foreground"
            : "text-foreground";
  return (
    <Card className="border-border">
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wider">
          {label}
        </div>
        <div className={"text-2xl font-bold mt-1 " + valueColor}>{value}</div>
      </CardContent>
    </Card>
  );
}

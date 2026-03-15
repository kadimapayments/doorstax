"use client";

import React, { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";

interface AuditLogRow {
  id: string;
  userId: string | null;
  userName: string | null;
  userRole: string | null;
  action: string;
  objectType: string;
  objectId: string | null;
  description: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

const ACTION_OPTIONS = ["ALL", "LOGIN", "CREATE", "UPDATE", "DELETE", "APPROVE", "PROCESS", "REFUND", "IMPERSONATE"];
const OBJECT_TYPE_OPTIONS = ["ALL", "Payment", "Payout", "Tenant", "User"];

const ACTION_COLORS: Record<string, string> = {
  LOGIN: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  CREATE: "bg-green-500/15 text-green-700 dark:text-green-400",
  UPDATE: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  DELETE: "bg-red-500/15 text-red-700 dark:text-red-400",
  APPROVE: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  PROCESS: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  REFUND: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  IMPERSONATE: "bg-pink-500/15 text-pink-700 dark:text-pink-400",
};

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [objectTypeFilter, setObjectTypeFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const perPage = 50;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), perPage: String(perPage) });
      if (actionFilter !== "ALL") params.set("action", actionFilter);
      if (objectTypeFilter !== "ALL") params.set("objectType", objectTypeFilter);
      if (search) params.set("search", search);

      const res = await fetch(`/api/admin/audit-logs?${params}`);
      const data = await res.json();
      setLogs(data.logs || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, objectTypeFilter, search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, actionFilter, objectTypeFilter]);

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="Track all actions across the platform."
      />

      {/* Summary */}
      {!loading && (
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="text-muted-foreground">
            <strong className="text-foreground">{total}</strong> entries
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search description, user, object ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {ACTION_OPTIONS.map((a) => (
            <Button
              key={a}
              variant={actionFilter === a ? "default" : "outline"}
              size="sm"
              onClick={() => setActionFilter(a)}
            >
              {a === "ALL" ? "All Actions" : a}
            </Button>
          ))}
        </div>
        <div className="flex gap-1">
          {OBJECT_TYPE_OPTIONS.map((t) => (
            <Button
              key={t}
              variant={objectTypeFilter === t ? "default" : "outline"}
              size="sm"
              onClick={() => setObjectTypeFilter(t)}
            >
              {t === "ALL" ? "All Types" : t}
            </Button>
          ))}
        </div>
      </div>

      {loading && logs.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          Loading audit logs...
        </div>
      ) : (
        <div className="rounded-lg border border-border card-glow">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No audit logs match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => {
                  const isExpanded = expandedId === log.id;
                  const hasDetails = log.oldValue || log.newValue;
                  return (
                    <React.Fragment key={log.id}>
                      <TableRow
                        className={`border-border ${hasDetails ? "cursor-pointer hover:bg-muted/50" : ""}`}
                        onClick={() => hasDetails && setExpandedId(isExpanded ? null : log.id)}
                      >
                        <TableCell className="w-[40px] px-2">
                          {hasDetails && (
                            isExpanded
                              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatTimestamp(log.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{log.userName || "System"}</div>
                          {log.userRole && (
                            <div className="text-xs text-muted-foreground">{log.userRole}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={ACTION_COLORS[log.action] || ""}
                          >
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{log.objectType}</TableCell>
                        <TableCell className="text-sm max-w-[300px] truncate">
                          {log.description || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {log.ipAddress || "—"}
                        </TableCell>
                      </TableRow>
                      {isExpanded && hasDetails && (
                        <TableRow className="border-border bg-muted/30">
                          <TableCell colSpan={7} className="px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              {log.oldValue && (
                                <div>
                                  <p className="font-semibold text-muted-foreground mb-2">Previous Values</p>
                                  <pre className="bg-background rounded-lg p-3 text-xs overflow-auto max-h-48 border border-border">
                                    {JSON.stringify(log.oldValue, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.newValue && (
                                <div>
                                  <p className="font-semibold text-muted-foreground mb-2">New Values</p>
                                  <pre className="bg-background rounded-lg p-3 text-xs overflow-auto max-h-48 border border-border">
                                    {JSON.stringify(log.newValue, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                            {log.objectId && (
                              <p className="mt-3 text-xs text-muted-foreground">
                                Object ID: <code className="bg-background px-1 py-0.5 rounded border border-border">{log.objectId}</code>
                              </p>
                            )}
                            {log.userAgent && (
                              <p className="mt-1 text-xs text-muted-foreground truncate">
                                User Agent: {log.userAgent}
                              </p>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

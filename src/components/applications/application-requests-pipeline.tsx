"use client";

import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/utils";
import { Inbox } from "lucide-react";

export interface ApplicationRequestRow {
  id: string;
  email: string;
  property: string;
  unit: string;
  status: "requested" | "opened" | "expired";
  requestedAt: string;
  clickedAt: string | null;
  clickCount: number;
  remindersSent: number;
  expiresAt: string;
}

export function ApplicationRequestsPipeline({
  rows,
}: {
  rows: ApplicationRequestRow[];
}) {
  const counts = {
    requested: rows.filter((r) => r.status === "requested").length,
    opened: rows.filter((r) => r.status === "opened").length,
    expired: rows.filter((r) => r.status === "expired").length,
  };

  const columns: Column<ApplicationRequestRow>[] = [
    {
      key: "email",
      header: "Email",
      cell: (row) => <span className="font-medium">{row.email}</span>,
    },
    { key: "property", header: "Property", cell: (row) => row.property },
    { key: "unit", header: "Unit", cell: (row) => row.unit },
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "clickCount",
      header: "Clicks",
      cell: (row) => (
        <span className="text-muted-foreground">
          {row.clickCount > 0 ? row.clickCount : "—"}
        </span>
      ),
    },
    {
      key: "remindersSent",
      header: "Reminders",
      cell: (row) => (
        <span className="text-muted-foreground">
          {row.remindersSent > 0 ? row.remindersSent : "—"}
        </span>
      ),
    },
    {
      key: "requestedAt",
      header: "Requested",
      cell: (row) => (
        <span className="text-muted-foreground">
          {formatDate(row.requestedAt)}
        </span>
      ),
    },
  ];

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Inbox className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-semibold text-base">Application Pipeline</h3>
            <p className="text-xs text-muted-foreground">
              Prospects who requested a link but haven&apos;t submitted yet
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="text-center">
            <div className="font-semibold text-sm">{counts.requested}</div>
            <div className="text-muted-foreground">Requested</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-sm">{counts.opened}</div>
            <div className="text-muted-foreground">Opened</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-sm text-muted-foreground">
              {counts.expired}
            </div>
            <div className="text-muted-foreground">Expired</div>
          </div>
        </div>
      </div>
      <DataTable columns={columns} data={rows} />
    </Card>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate } from "@/lib/utils";
import { Plus } from "lucide-react";

interface Ticket {
  id: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  tenant: { user: { name: string } };
  unit: { unitNumber: string; property: { name: string } };
}

const statuses = ["All", "OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

export default function LandlordTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => {
    fetch("/api/tickets")
      .then((r) => r.json())
      .then((data) => setTickets(Array.isArray(data) ? data : []));
  }, []);

  const columns: Column<Ticket>[] = [
    {
      key: "title",
      header: "Title",
      cell: (row) => (
        <Link href={`/dashboard/tickets/${row.id}`} className="font-medium hover:underline">
          {row.title}
        </Link>
      ),
    },
    {
      key: "tenant",
      header: "Tenant",
      cell: (row) => row.tenant?.user?.name || "—",
    },
    {
      key: "property",
      header: "Property",
      cell: (row) =>
        `${row.unit?.property?.name || "—"} #${row.unit?.unitNumber || "—"}`,
    },
    { key: "category", header: "Category", cell: (row) => row.category.replace("_", " ") },
    {
      key: "priority",
      header: "Priority",
      cell: (row) => <StatusBadge status={row.priority} />,
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "date",
      header: "Created",
      cell: (row) => formatDate(new Date(row.createdAt)),
    },
  ];

  const filtered = statusFilter === "All"
    ? tickets
    : tickets.filter((t) => t.status === statusFilter);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Service Tickets"
        description="View and manage tenant service requests."
        actions={
          <Link href="/dashboard/tickets/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Ticket
            </Button>
          </Link>
        }
      />
      <div className="flex gap-1">
        {statuses.map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(s)}
          >
            {s === "All"
              ? "All"
              : s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </Button>
        ))}
      </div>
      <DataTable
        columns={columns}
        data={filtered}
        emptyMessage="No service tickets."
      />
    </div>
  );
}

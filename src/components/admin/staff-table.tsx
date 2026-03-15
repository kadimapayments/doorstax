"use client";

import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/utils";
import { ADMIN_ROLE_LABELS } from "@/lib/admin-permissions";
import type { AdminRole } from "@prisma/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil } from "lucide-react";

export interface StaffRow {
  id: string;
  userId: string;
  name: string;
  email: string;
  adminRole: AdminRole;
  isActive: boolean;
  invitedAt: string;
}

export function StaffTable({ rows }: { rows: StaffRow[] }) {
  const router = useRouter();

  const columns: Column<StaffRow>[] = [
    { key: "name", header: "Name", cell: (row) => <span className="font-medium">{row.name}</span> },
    { key: "email", header: "Email", cell: (row) => <span className="text-muted-foreground">{row.email}</span> },
    {
      key: "adminRole",
      header: "Role",
      cell: (row) => ADMIN_ROLE_LABELS[row.adminRole] || row.adminRole,
    },
    {
      key: "isActive",
      header: "Status",
      cell: (row) => <StatusBadge status={row.isActive ? "ACTIVE" : "CANCELLED"} />,
    },
    {
      key: "invitedAt",
      header: "Added",
      cell: (row) => formatDate(new Date(row.invitedAt)),
    },
    {
      key: "actions",
      header: "",
      cell: (row) => (
        <Link
          href={`/admin/staff/${row.id}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          <Pencil className="h-4 w-4" />
        </Link>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      onRowClick={(row) => router.push(`/admin/staff/${row.id}`)}
      emptyMessage="No staff members yet."
    />
  );
}

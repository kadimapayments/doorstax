"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { UsersRound, Search, MoreHorizontal, Eye, Pencil, FileText, Bell, CreditCard, Layers, LayoutGrid, Trash2, KeyRound, User } from "lucide-react";
import { SendNoticeDialog } from "@/components/tenants/send-notice-dialog";
import { EditTenantDialog } from "@/components/tenants/edit-tenant-dialog";
import { DeleteTenantDialog } from "@/components/tenants/delete-tenant-dialog";
import { ResetPasswordDialog } from "@/components/tenants/reset-password-dialog";
import { TenantBuildingStack } from "@/components/tenants/tenant-building-stack";

export interface TenantRow {
  id: string;
  userId: string;
  unitId: string;
  name: string;
  email: string;
  phone: string | null;
  property: string;
  unit: string;
  rent: number;
  split: number;
  isPrimary: boolean;
  autopay: boolean;
  status: string;
}

function TenantActionsDropdown({
  row,
  linkPrefix = "/dashboard/tenants",
}: {
  row: TenantRow;
  linkPrefix?: string;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resetPwOpen, setResetPwOpen] = useState(false);

  async function handleViewAs() {
    const res = await fetch("/api/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: row.id }),
    });
    if (res.ok) {
      router.push("/tenant");
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`${linkPrefix}/${row.id}`}>
              <User className="h-4 w-4" />
              View Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleViewAs}>
            <Eye className="h-4 w-4" />
            View As
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/tenants/${row.id}/roommates`}>
              <UsersRound className="h-4 w-4" />
              Roommates
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {row.unitId && (
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/leases/new?tenantId=${row.id}&unitId=${row.unitId}`}>
                <FileText className="h-4 w-4" />
                Create Lease
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setNoticeOpen(true)}>
            <Bell className="h-4 w-4" />
            Send Notice
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/payments?tenantId=${row.id}`}>
              <CreditCard className="h-4 w-4" />
              View Payments
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setResetPwOpen(true)}>
            <KeyRound className="h-4 w-4" />
            Reset Password
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Remove Tenant
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit dialog controlled by state */}
      <EditTenantDialog
        tenant={{
          id: row.id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          status: row.status,
        }}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      {/* Notice dialog controlled by state */}
      <SendNoticeDialog
        targetUserId={row.userId}
        targetName={row.name}
        open={noticeOpen}
        onOpenChange={setNoticeOpen}
      />

      {/* Delete dialog controlled by state */}
      <DeleteTenantDialog
        tenant={{ id: row.id, name: row.name }}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />

      {/* Reset password dialog */}
      <ResetPasswordDialog
        tenant={{ id: row.id, name: row.name }}
        open={resetPwOpen}
        onOpenChange={setResetPwOpen}
      />
    </>
  );
}

const PAGE_SIZE = 20;

export function TenantTable({
  rows,
  linkPrefix = "/dashboard/tenants",
}: {
  rows: TenantRow[];
  linkPrefix?: string;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [propertyFilter, setPropertyFilter] = useState("");
  const [autopayFilter, setAutopayFilter] = useState<"" | "on" | "off">("");
  const [viewMode, setViewMode] = useState<"stack" | "table">("table");

  // Derive unique properties from the data
  const properties = useMemo(() => {
    const set = new Set(rows.map((r) => r.property).filter((p) => p && p !== "—"));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = rows.filter((r) => {
    if (propertyFilter && r.property !== propertyFilter) return false;
    if (autopayFilter === "on" && !r.autopay) return false;
    if (autopayFilter === "off" && r.autopay) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.property.toLowerCase().includes(q) ||
      r.unit.toLowerCase().includes(q)
    );
  });

  // Group tenants by building for stack view
  const buildingGroups = useMemo(() => {
    const groups: Record<string, TenantRow[]> = {};
    for (const row of filtered) {
      const key = row.property || "Unassigned";
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: Column<TenantRow>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      sortFn: (a, b) => a.name.localeCompare(b.name),
      cell: (row) => (
        <div>
          <Link href={`${linkPrefix}/${row.id}`} className="font-medium hover:underline hover:text-primary">
            {row.name}
          </Link>
          {!row.isPrimary && (
            <span className="ml-2 text-xs text-muted-foreground">(Roommate)</span>
          )}
        </div>
      ),
    },
    { key: "email", header: "Email", sortable: true, sortFn: (a, b) => (a.email || "").localeCompare(b.email || ""), cell: (row) => <span className="text-muted-foreground">{row.email}</span> },
    { key: "property", header: "Property", sortable: true, sortFn: (a, b) => a.property.localeCompare(b.property), cell: (row) => row.property },
    { key: "unit", header: "Unit", cell: (row) => row.unit },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortFn: (a, b) => a.status.localeCompare(b.status),
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "rent",
      header: "Rent / Split",
      sortable: true,
      sortFn: (a, b) => a.rent - b.rent,
      cell: (row) => (
        <div>
          <span>{formatCurrency(row.rent * row.split / 100)}</span>
          {row.split < 100 && (
            <span className="ml-1 text-xs text-muted-foreground">({row.split}%)</span>
          )}
        </div>
      ),
    },
    {
      key: "autopay",
      header: "Autopay",
      cell: (row) => <StatusBadge status={row.autopay ? "ACTIVE" : "PAUSED"} />,
    },
    {
      key: "actions",
      header: "",
      cell: (row) => <TenantActionsDropdown row={row} linkPrefix={linkPrefix} />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tenants..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
          {properties.length > 1 && (
            <select
              value={propertyFilter}
              onChange={(e) => { setPropertyFilter(e.target.value); setPage(1); }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">All Properties</option>
              {properties.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          )}
          <select
            value={autopayFilter}
            onChange={(e) => { setAutopayFilter(e.target.value as "" | "on" | "off"); setPage(1); }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="">All Autopay</option>
            <option value="on">Autopay On</option>
            <option value="off">Autopay Off</option>
          </select>
        </div>

        {/* View toggle */}
        {properties.length > 1 && (
          <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
            <button
              onClick={() => setViewMode("stack")}
              className={cn(
                "rounded p-1.5 transition-colors",
                viewMode === "stack"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Building stack view"
            >
              <Layers className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={cn(
                "rounded p-1.5 transition-colors",
                viewMode === "table"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Table view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground">
        {filtered.length} tenant{filtered.length !== 1 ? "s" : ""}
        {propertyFilter && <> in {propertyFilter}</>}
        {viewMode === "stack" && <> &middot; {buildingGroups.length} building{buildingGroups.length !== 1 ? "s" : ""}</>}
      </p>

      {viewMode === "stack" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {buildingGroups.map(([propertyName, tenants]) => (
            <TenantBuildingStack key={propertyName} propertyName={propertyName} tenants={tenants} />
          ))}
        </div>
      ) : (
        <DataTable columns={columns} data={paginated} page={page} totalPages={totalPages} onPageChange={setPage} />
      )}
    </div>
  );
}

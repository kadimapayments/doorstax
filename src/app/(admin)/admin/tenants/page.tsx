export const dynamic = "force-dynamic";

import { requireAdminPermission } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { TenantTable } from "@/components/tenants/tenant-table";
import { TenantStatusFilter } from "@/components/tenants/tenant-status-filter";
import { Users, CreditCard, Shield, Percent } from "lucide-react";

export const metadata = { title: "Tenants — Admin" };

interface AdminTenantsPageProps {
  searchParams: Promise<{ status?: string; landlord?: string }>;
}

export default async function AdminTenantsPage({ searchParams }: AdminTenantsPageProps) {
  await requireAdminPermission("admin:tenants");

  const { status, landlord } = await searchParams;
  const validStatuses = ["ACTIVE", "PROSPECT", "PREVIOUS"];
  const statusFilter = status && validStatuses.includes(status) ? status : undefined;

  // Fetch all tenants across the platform (optionally filtered by landlord)
  const allTenants = await db.tenantProfile.findMany({
    where: {
      deletedAt: null,
      ...(landlord
        ? { unit: { property: { landlordId: landlord } } }
        : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      unit: {
        select: {
          id: true,
          unitNumber: true,
          rentAmount: true,
          property: {
            select: {
              name: true,
              landlord: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Compute counts for each status
  const counts: Record<string, number> = { ALL: allTenants.length };
  for (const t of allTenants) {
    counts[t.status] = (counts[t.status] || 0) + 1;
  }

  // Filter tenants by status if specified
  const filtered = statusFilter
    ? allTenants.filter((t) => t.status === statusFilter)
    : allTenants;

  const rows = filtered.map((t) => ({
    id: t.id,
    userId: t.user.id,
    unitId: t.unitId || "",
    name: t.user.name,
    email: t.user.email,
    phone: t.user.phone,
    property: t.unit?.property.name || "—",
    unit: t.unit?.unitNumber || "—",
    rent: Number(t.unit?.rentAmount || 0),
    split: t.splitPercent,
    isPrimary: t.isPrimary,
    autopay: t.autopayEnabled,
    status: t.status,
  }));

  // Extract unique landlords for filter
  const landlordMap = new Map<string, string>();
  for (const t of allTenants) {
    const ll = t.unit?.property.landlord;
    if (ll) landlordMap.set(ll.id, ll.name);
  }
  const landlords = Array.from(landlordMap.entries()).map(([id, name]) => ({ id, name }));

  // Tenant insights metrics
  const totalTenants = allTenants.length;
  const activeTenants = allTenants.filter((t) => t.status === "ACTIVE").length;
  const autopayCount = allTenants.filter((t) => t.autopayEnabled).length;
  const autopayRate = totalTenants > 0 ? Math.round((autopayCount / totalTenants) * 100) : 0;
  const creditReportingCount = allTenants.filter((t) => t.creditReportingEnrolled).length;
  const creditReportingRate = totalTenants > 0 ? Math.round((creditReportingCount / totalTenants) * 100) : 0;
  const avgSplit = totalTenants > 0 ? Math.round(allTenants.reduce((sum, t) => sum + t.splitPercent, 0) / totalTenants) : 100;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenants"
        description={`All tenant profiles across the platform.${landlord ? ` Filtered by manager.` : ""}`}
      />

      {/* Landlord filter */}
      {landlords.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Manager:</span>
          <select
            className="rounded-md border bg-background px-3 py-1.5 text-sm"
            defaultValue={landlord || ""}
            // Client-side navigation handled via form or link — using a simple form
          >
            <option value="">All Managers</option>
            {landlords.map((ll) => (
              <option key={ll.id} value={ll.id}>
                {ll.name}
              </option>
            ))}
          </select>
          {/* Simple JS to navigate on change */}
          <script
            dangerouslySetInnerHTML={{
              __html: `document.querySelector('select').addEventListener('change',function(){var v=this.value;var u='/admin/tenants';if(v)u+='?landlord='+v;window.location.href=u;})`,
            }}
          />
        </div>
      )}

      {/* Tenant Insights Widget */}
      {totalTenants > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border bg-card p-4 card-glow">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Users className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Total Tenants</span>
            </div>
            <p className="text-2xl font-bold">{totalTenants}</p>
            <p className="text-xs text-muted-foreground mt-1">{activeTenants} active &middot; {totalTenants - activeTenants} other</p>
          </div>
          <div className="rounded-xl border bg-card p-4 card-glow">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <CreditCard className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Autopay Adoption</span>
            </div>
            <p className="text-2xl font-bold">{autopayRate}%</p>
            <p className="text-xs text-muted-foreground mt-1">{autopayCount} of {totalTenants} tenants enrolled</p>
          </div>
          <div className="rounded-xl border bg-card p-4 card-glow">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Shield className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Credit Reporting</span>
            </div>
            <p className="text-2xl font-bold">{creditReportingRate}%</p>
            <p className="text-xs text-muted-foreground mt-1">{creditReportingCount} of {totalTenants} tenants enrolled</p>
          </div>
          <div className="rounded-xl border bg-card p-4 card-glow">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Percent className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Avg Split</span>
            </div>
            <p className="text-2xl font-bold">{avgSplit}%</p>
            <p className="text-xs text-muted-foreground mt-1">{avgSplit === 100 ? "No rent splitting" : "Tenants share rent"}</p>
          </div>
        </div>
      )}

      <TenantStatusFilter current={statusFilter || ""} counts={counts} />

      <TenantTable rows={rows} linkPrefix="/admin/tenants" />
    </div>
  );
}

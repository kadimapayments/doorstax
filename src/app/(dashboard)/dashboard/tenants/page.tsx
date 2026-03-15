import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth-utils";
import { getTeamContext, can } from "@/lib/team-context";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Users, UserPlus, Upload, CreditCard, Shield, Percent, ArrowLeftRight, ClipboardList } from "lucide-react";
import { TenantTable } from "@/components/tenants/tenant-table";
import { TenantStatusFilter } from "@/components/tenants/tenant-status-filter";
import { PendingInvites } from "@/components/tenants/pending-invites";

export const metadata = { title: "Tenants" };

interface TenantsPageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function TenantsPage({ searchParams }: TenantsPageProps) {
  const user = await requireRole("PM");
  const ctx = await getTeamContext(user.id);
  if (!can(ctx, "tenants:read")) redirect("/dashboard");

  const canWrite = can(ctx, "tenants:write");

  const { status } = await searchParams;
  const validStatuses = ["ACTIVE", "PROSPECT", "PREVIOUS"];
  const statusFilter = status && validStatuses.includes(status) ? status : undefined;

  // Always fetch all tenants to compute counts, then filter for display
  const allTenants = await db.tenantProfile.findMany({
    where: {
      unit: { property: { landlordId: ctx.landlordId } },
      deletedAt: null,
    },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      unit: {
        select: {
          unitNumber: true,
          rentAmount: true,
          property: { select: { name: true } },
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
        description="Manage tenants across your properties."
        actions={
          canWrite ? (
            <div className="flex gap-2">
              <Link href="/dashboard/tenants/add">
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add Tenant
                </Button>
              </Link>
              <Link href="/dashboard/tenants/invite">
                <Button variant="outline">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Invite Tenant
                </Button>
              </Link>
              <Link href="/dashboard/tenants/import">
                <Button variant="outline">
                  <Upload className="mr-2 h-4 w-4" />
                  Import
                </Button>
              </Link>
              <Link href="/dashboard/tenants/migrate">
                <Button variant="outline">
                  <ArrowLeftRight className="mr-2 h-4 w-4" />
                  Migrate
                </Button>
              </Link>
              <Link href="/dashboard/tenants/onboarding">
                <Button variant="outline" size="sm">
                  <ClipboardList className="mr-2 h-4 w-4" />
                  Onboarding
                </Button>
              </Link>
            </div>
          ) : undefined
        }
      />

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

      {canWrite && <PendingInvites />}

      <TenantStatusFilter current={statusFilter || ""} counts={counts} />

      {rows.length === 0 ? (
        <EmptyState
          icon={<Users className="h-12 w-12" />}
          title="No tenants yet"
          description="Add your first tenant or send an invite to get started."
          action={
            canWrite ? (
              <div className="flex gap-2">
                <Link href="/dashboard/tenants/add">
                  <Button>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add Tenant
                  </Button>
                </Link>
                <Link href="/dashboard/tenants/invite">
                  <Button variant="outline">Invite Tenant</Button>
                </Link>
              </div>
            ) : undefined
          }
        />
      ) : (
        <TenantTable rows={rows} />
      )}
    </div>
  );
}

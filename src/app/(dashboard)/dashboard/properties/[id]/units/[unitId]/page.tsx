import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { ArrowLeft, UserPlus, FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditUnitDialog } from "@/components/units/edit-unit-dialog";
import { AssignTenantDialog } from "@/components/units/assign-tenant-dialog";
import { EvictionTracker } from "@/components/evictions/eviction-tracker";
import { UnitScreeningSection } from "@/components/rentspree/unit-screening-section";

export default async function UnitDetailPage({
  params,
}: {
  params: Promise<{ id: string; unitId: string }>;
}) {
  const user = await requireRole("PM");
  const { id, unitId } = await params;

  const unit = await db.unit.findFirst({
    where: {
      id: unitId,
      propertyId: id,
      property: { landlordId: user.id },
    },
    include: {
      property: { select: { name: true, address: true } },
      tenantProfiles: {
        include: {
          user: { select: { name: true, email: true, phone: true } },
        },
      },
      leases: {
        where: { status: "ACTIVE" },
        take: 1,
      },
      payments: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!unit) notFound();

  // Fetch PM screening defaults
  const pmUser = await db.user.findUnique({
    where: { id: user.id },
    select: {
      screeningCreditReport: true,
      screeningCriminal: true,
      screeningEviction: true,
      screeningApplication: true,
      screeningPayerType: true,
    },
  });

  // Unit expenses
  const unitExpenses = await db.expense.findMany({
    where: { unitId },
    include: {
      tenant: { include: { user: { select: { name: true } } } },
    },
    orderBy: { date: "desc" },
    take: 10,
  });

  const tenant = unit.tenantProfiles[0];
  const hasActiveLease = unit.leases.length > 0;

  return (
    <div className="space-y-6">
      <Link
        href={`/dashboard/properties/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to {unit.property.name}
      </Link>

      <PageHeader
        title={`Unit ${unit.unitNumber}`}
        description={unit.property.name}
        actions={
          <EditUnitDialog
            propertyId={id}
            unit={{
              id: unit.id,
              unitNumber: unit.unitNumber,
              bedrooms: unit.bedrooms,
              bathrooms: unit.bathrooms,
              sqft: unit.sqft,
              rentAmount: Number(unit.rentAmount),
              dueDay: unit.dueDay,
              description: unit.description,
              photos: unit.photos || [],
            }}
          />
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Unit Info */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Unit Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <StatusBadge status={unit.status} />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rent</span>
              <span className="font-medium">
                {formatCurrency(Number(unit.rentAmount))}/mo
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Due Day</span>
              <span>{unit.dueDay}th of each month</span>
            </div>
            {unit.bedrooms !== null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bedrooms</span>
                <span>{unit.bedrooms}</span>
              </div>
            )}
            {unit.bathrooms !== null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bathrooms</span>
                <span>{unit.bathrooms}</span>
              </div>
            )}
            {unit.sqft !== null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sq Ft</span>
                <span>{unit.sqft.toLocaleString()}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tenant Info */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Tenant</CardTitle>
          </CardHeader>
          <CardContent>
            {tenant ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium">{tenant.user.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span>{tenant.user.email}</span>
                </div>
                {tenant.user.phone && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phone</span>
                    <span>{tenant.user.phone}</span>
                  </div>
                )}
                {tenant.leaseStart && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lease Start</span>
                    <span>{formatDate(tenant.leaseStart)}</span>
                  </div>
                )}
                {tenant.leaseEnd && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lease End</span>
                    <span>{formatDate(tenant.leaseEnd)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Autopay</span>
                  <StatusBadge
                    status={tenant.autopayEnabled ? "ACTIVE" : "PAUSED"}
                  />
                </div>
                {!hasActiveLease && (
                  <div className="mt-4 rounded-md border border-primary/30 bg-primary/5 p-3">
                    <p className="text-sm text-muted-foreground mb-2">
                      No active lease for this tenant.
                    </p>
                    <Link href={`/dashboard/leases/new?unitId=${unitId}&tenantId=${tenant.id}`}>
                      <Button size="sm">
                        <FileText className="mr-2 h-4 w-4" />
                        Create Lease
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <UserPlus className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground mb-4">
                  No tenant assigned to this unit.
                </p>
                <AssignTenantDialog unitId={unitId} propertyId={id} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tenant Screening */}
      <UnitScreeningSection
        unitId={unit.id}
        propertyId={id}
        applyLink={unit.applyLink}
        applyLinkFull={unit.applyLinkFull}
        applyLinkGeneratedAt={unit.applyLinkGeneratedAt?.toISOString() ?? null}
        screeningOverrides={{
          creditReport: unit.screeningCreditReport,
          criminal: unit.screeningCriminal,
          eviction: unit.screeningEviction,
          application: unit.screeningApplication,
          payerType: unit.screeningPayerType,
        }}
        pmDefaults={{
          creditReport: pmUser?.screeningCreditReport ?? true,
          criminal: pmUser?.screeningCriminal ?? true,
          eviction: pmUser?.screeningEviction ?? true,
          application: pmUser?.screeningApplication ?? true,
          payerType: pmUser?.screeningPayerType ?? "landlord",
        }}
        propertyState={
          unit.property.address
            ? (() => {
                const m = unit.property.address.match(/\b([A-Z]{2})\b(?=\s+\d{5})/);
                return m ? m[1] : undefined;
              })()
            : undefined
        }
      />

      {/* Eviction Tracker */}
      {tenant && (
        <EvictionTracker
          tenantId={tenant.id}
          tenantName={tenant.user.name}
          propertyName={unit.property.name}
          unitNumber={unit.unitNumber}
        />
      )}

      {/* Unit Expenses */}
      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Expenses</CardTitle>
          <Link href={`/dashboard/expenses/new?propertyId=${id}&unitId=${unitId}`}>
            <Button variant="outline" size="sm">
              <Plus className="mr-1 h-3 w-3" />
              Add
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {unitExpenses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No expenses for this unit.</p>
          ) : (
            <div className="space-y-2">
              {unitExpenses.map((exp) => (
                <div key={exp.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                  <div>
                    <span className="font-medium">{exp.description}</span>
                    <span className="text-xs text-muted-foreground ml-2">{new Date(exp.date).toLocaleDateString()}</span>
                    {exp.tenant?.user?.name && (
                      <span className="text-xs text-amber-500 ml-2">→ {exp.tenant.user.name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-xs px-1.5 py-0.5 rounded",
                      exp.status === "PAID" ? "bg-emerald-500/10 text-emerald-500" :
                      exp.status === "INVOICED" ? "bg-amber-500/10 text-amber-500" :
                      "bg-muted text-muted-foreground"
                    )}>
                      {exp.status?.charAt(0) + exp.status?.slice(1).toLowerCase()}
                    </span>
                    <span className="font-medium">{formatCurrency(Number(exp.amount))}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Payments */}
      {unit.payments.length > 0 && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Recent Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {unit.payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {formatCurrency(Number(payment.amount))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Due {formatDate(payment.dueDate)}
                    </p>
                  </div>
                  <StatusBadge status={payment.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

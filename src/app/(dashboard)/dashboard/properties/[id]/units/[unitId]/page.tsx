import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function UnitDetailPage({
  params,
}: {
  params: Promise<{ id: string; unitId: string }>;
}) {
  const user = await requireRole("LANDLORD");
  const { id, unitId } = await params;

  const unit = await db.unit.findFirst({
    where: {
      id: unitId,
      propertyId: id,
      property: { landlordId: user.id },
    },
    include: {
      property: { select: { name: true } },
      tenantProfiles: {
        include: {
          user: { select: { name: true, email: true, phone: true } },
        },
      },
      payments: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!unit) notFound();

  const tenant = unit.tenantProfiles[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Unit ${unit.unitNumber}`}
        description={unit.property.name}
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
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No tenant assigned to this unit.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

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

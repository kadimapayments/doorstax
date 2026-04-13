export const dynamic = "force-dynamic";

import { requireAdminPermission } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Tenant Profile — Admin" };

export default async function AdminTenantProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPermission("admin:tenants");
  const { id } = await params;

  const tenant = await db.tenantProfile.findUnique({
    where: { id },
    include: {
      user: {
        select: { name: true, email: true, phone: true, createdAt: true },
      },
      unit: {
        include: {
          property: {
            select: {
              name: true,
              address: true,
              city: true,
              state: true,
              zip: true,
              landlordId: true,
              landlord: { select: { name: true, email: true, companyName: true } },
            },
          },
        },
      },
    },
  });

  if (!tenant) notFound();

  // Recent payments
  const payments = await db.payment.findMany({
    where: { tenantId: id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      amount: true,
      status: true,
      paymentMethod: true,
      createdAt: true,
      description: true,
    },
  });

  const pm = tenant.unit?.property?.landlord;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/tenants"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Tenants
      </Link>

      <PageHeader
        title={tenant.user?.name || "Tenant"}
        description={tenant.user?.email || ""}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Contact info */}
        <Card className="border-border">
          <CardContent className="p-5 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Contact Information
            </h3>
            <Row label="Name" value={tenant.user?.name || "—"} />
            <Row label="Email" value={tenant.user?.email || "—"} />
            <Row label="Phone" value={tenant.user?.phone || "—"} />
            <Row
              label="Joined"
              value={
                tenant.user?.createdAt
                  ? formatDate(tenant.user.createdAt.toISOString())
                  : "—"
              }
            />
          </CardContent>
        </Card>

        {/* Unit & Property */}
        <Card className="border-border">
          <CardContent className="p-5 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Unit & Property
            </h3>
            <Row
              label="Unit"
              value={tenant.unit?.unitNumber || "Not assigned"}
            />
            <Row
              label="Property"
              value={tenant.unit?.property?.name || "—"}
            />
            <Row
              label="Address"
              value={
                tenant.unit?.property
                  ? `${tenant.unit.property.address}, ${tenant.unit.property.city}, ${tenant.unit.property.state}`
                  : "—"
              }
            />
            <Row label="Rent" value={formatCurrency(Number(tenant.unit?.rentAmount ?? 0))} />
            {tenant.leaseStart && (
              <Row
                label="Lease"
                value={`${formatDate(tenant.leaseStart.toISOString())} — ${tenant.leaseEnd ? formatDate(tenant.leaseEnd.toISOString()) : "Month-to-month"}`}
              />
            )}
          </CardContent>
        </Card>

        {/* Property Manager */}
        <Card className="border-border">
          <CardContent className="p-5 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Property Manager
            </h3>
            <Row label="Name" value={pm?.name || "—"} />
            <Row label="Email" value={pm?.email || "—"} />
            <Row label="Company" value={pm?.companyName || "—"} />
          </CardContent>
        </Card>

        {/* Payment info */}
        <Card className="border-border">
          <CardContent className="p-5 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Payment Method
            </h3>
            <Row
              label="Method"
              value={tenant.paymentMethodType || "Not set"}
            />
            {tenant.cardLast4 && (
              <Row label="Card" value={`${tenant.cardBrand || "Card"} ending ${tenant.cardLast4}`} />
            )}
            {tenant.bankLast4 && (
              <Row label="Bank" value={`${tenant.bankAccountType || "Account"} ending ${tenant.bankLast4}`} />
            )}
            <Row
              label="Autopay"
              value={tenant.autopayEnabled ? "Enabled" : "Disabled"}
            />
          </CardContent>
        </Card>
      </div>

      {/* Payment history */}
      <Card className="border-border">
        <CardContent className="p-5 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Payment History
          </h3>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No payment activity.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2 pr-4">Date</th>
                    <th className="text-right py-2 pr-4">Amount</th>
                    <th className="text-center py-2 pr-4">Method</th>
                    <th className="text-center py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 text-xs text-muted-foreground">
                        {formatDate(p.createdAt.toISOString())}
                      </td>
                      <td className="py-2 pr-4 text-right font-medium">
                        {formatCurrency(Number(p.amount))}
                      </td>
                      <td className="py-2 pr-4 text-center">
                        <Badge variant="outline" className="text-[10px]">
                          {p.paymentMethod || "—"}
                        </Badge>
                      </td>
                      <td className="py-2 text-center">
                        <Badge
                          variant="outline"
                          className={
                            p.status === "COMPLETED"
                              ? "bg-emerald-500/15 text-emerald-500"
                              : p.status === "FAILED"
                                ? "bg-red-500/15 text-red-500"
                                : "bg-amber-500/15 text-amber-500"
                          }
                        >
                          {p.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

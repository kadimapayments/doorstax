import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth-utils";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import {
  ArrowLeft, User, Mail, Phone, Building2, CreditCard, FileText,
  AlertTriangle, DollarSign, RefreshCw, Landmark, History, LifeBuoy,
} from "lucide-react";
import { EvictionTracker } from "@/components/evictions/eviction-tracker";
import { TenantParkingSection } from "@/components/parking/tenant-parking-section";
import { BalanceManager } from "@/components/tenants/balance-manager";
import { CollapsibleList } from "@/components/tenants/collapsible-list";
import { ImpersonateButton } from "@/components/tenants/impersonate-button";
import { TenantExpenses } from "@/components/tenants/tenant-expenses";
import {
  RecoveryProgressBar,
  RecoveryStatusBadge,
  type RecoveryPlanStatus,
} from "@/components/recovery/progress-bar";
import { TenantNotesPanel } from "@/components/tenant-notes/tenant-notes-panel";

export const metadata = { title: "Tenant Profile" };

export default async function TenantProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("PM");
  const landlordId = await getEffectiveLandlordId(user.id);
  const { id } = await params;

  const tenant = await db.tenantProfile.findFirst({
    where: {
      id,
      unit: { property: { landlordId } },
    },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, createdAt: true } },
      unit: {
        include: {
          property: { select: { id: true, name: true, address: true, city: true, state: true, zip: true } },
        },
      },
      leases: {
        where: { status: "ACTIVE" },
        take: 1,
        orderBy: { startDate: "desc" },
      },
      recurringBilling: true,
      payments: {
        orderBy: { createdAt: "desc" },
        take: 15,
        select: {
          id: true,
          amount: true,
          type: true,
          status: true,
          paymentMethod: true,
          cardBrand: true,
          cardLast4: true,
          achLast4: true,
          paidAt: true,
          dueDate: true,
          description: true,
          createdAt: true,
        },
      },
      expenses: {
        orderBy: { date: "desc" },
        take: 20,
        select: {
          id: true,
          description: true,
          amount: true,
          date: true,
          status: true,
          payableBy: true,
          category: true,
        },
      },
      ledgerEntries: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { balanceAfter: true },
      },
      tenantDocuments: {
        orderBy: { uploadedAt: "desc" },
        select: {
          id: true,
          name: true,
          type: true,
          url: true,
          fileName: true,
          uploadedAt: true,
          source: true,
        },
      },
      parkingAssignments: {
        where: { status: "ACTIVE" },
        include: {
          space: {
            include: {
              lot: { select: { name: true, type: true } },
            },
          },
        },
      },
    },
  });

  if (!tenant) notFound();

  // Recovery-plan cross-reference — surfaces on the tenant profile so a
  // PM browsing Cindy's row immediately sees that she's on a plan (or
  // has a recent terminal one), without needing to open the Delinquency
  // hub.
  const activeRecoveryPlan = await db.recoveryPlan.findFirst({
    where: {
      tenantId: tenant.id,
      status: { in: ["PLAN_OFFERED", "PLAN_ACTIVE", "PLAN_AT_RISK"] },
    },
    select: {
      id: true,
      status: true,
      originalBalance: true,
      forgivenessAmount: true,
      completedPayments: true,
      requiredPayments: true,
      startDate: true,
      endDate: true,
    },
  });

  // Fetch roommates (other active tenants on the same unit) for split billing
  const roommates = tenant.unitId
    ? await db.tenantProfile.findMany({
        where: { unitId: tenant.unitId },
        include: { user: { select: { name: true } } },
      })
    : [];

  const activeLease = tenant.leases[0];
  const currentBalance = tenant.ledgerEntries[0] ? Number(tenant.ledgerEntries[0].balanceAfter) : 0;
  const totalPaid = tenant.payments
    .filter((p) => p.status === "COMPLETED")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const unpaidCount = tenant.payments.filter((p) => p.status === "PENDING" || p.status === "FAILED").length;
  const monthlyRent = tenant.unit ? Number(tenant.unit.rentAmount) * tenant.splitPercent / 100 : 0;

  // Build expense → payment mapping for clickable links
  const expensePaymentMap = new Map<string, string>();
  const linkedExpenses = await db.expense.findMany({
    where: { tenantId: tenant.id, paymentId: { not: null } },
    select: { id: true, paymentId: true },
  });
  for (const exp of linkedExpenses) {
    if (exp.paymentId) expensePaymentMap.set(exp.paymentId, exp.id);
  }

  const cardDisplay = tenant.cardBrand
    ? tenant.cardBrand.charAt(0).toUpperCase() + tenant.cardBrand.slice(1) + " •••• " + tenant.cardLast4
    : tenant.cardLast4 ? "Card •••• " + tenant.cardLast4 : null;
  const achDisplay = tenant.bankLast4 ? (tenant.bankAccountType || "Checking") + " •••• " + tenant.bankLast4 : null;

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/tenants"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Tenants
      </Link>

      <div className="flex items-start justify-between">
        <PageHeader
          title={tenant.user.name}
          description={tenant.unit ? `${tenant.unit.property.name} — Unit ${tenant.unit.unitNumber}` : "No unit assigned"}
        />
        <div className="flex items-center gap-2">
          <StatusBadge status={tenant.status} />
          <ImpersonateButton tenantId={tenant.id} />
        </div>
      </div>

      {/* Top metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              Monthly Rent
            </div>
            <p className="text-2xl font-bold">{formatCurrency(monthlyRent)}</p>
            {tenant.splitPercent < 100 && (
              <p className="text-xs text-muted-foreground">{tenant.splitPercent}% of {formatCurrency(Number(tenant.unit?.rentAmount || 0))}</p>
            )}
          </CardContent>
        </Card>
        <Card className={cn("border-border", currentBalance > 0.01 ? "border-red-500/30" : "")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <AlertTriangle className="h-4 w-4" />
              Current Balance
            </div>
            <p className={cn("text-2xl font-bold", currentBalance > 0.01 ? "text-red-500" : currentBalance < -0.01 ? "text-amber-500" : "text-emerald-500")}>
              {formatCurrency(currentBalance)}
            </p>
            {unpaidCount > 0 && <p className="text-xs text-red-500">{unpaidCount} unpaid charge{unpaidCount !== 1 ? "s" : ""}</p>}
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <History className="h-4 w-4" />
              Total Paid
            </div>
            <p className="text-2xl font-bold">{formatCurrency(totalPaid)}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <RefreshCw className="h-4 w-4" />
              Autopay
            </div>
            <p className="text-2xl font-bold">{tenant.autopayEnabled ? "Active" : "Off"}</p>
            {tenant.recurringBilling && (
              <p className="text-xs text-muted-foreground">Day {tenant.recurringBilling.dayOfMonth} — {tenant.recurringBilling.paymentMethod}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recovery plan cross-reference — quiet when no plan, loud when active. */}
      {activeRecoveryPlan && (
        <Card className="border-border border-primary/30 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <LifeBuoy className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Recovery plan</span>
                <RecoveryStatusBadge
                  status={activeRecoveryPlan.status as RecoveryPlanStatus}
                />
              </div>
              <Link
                href={`/dashboard/delinquency/${activeRecoveryPlan.id}`}
                className="text-xs text-primary hover:underline"
              >
                Open plan →
              </Link>
            </div>
            <RecoveryProgressBar
              completed={activeRecoveryPlan.completedPayments}
              required={activeRecoveryPlan.requiredPayments}
              status={activeRecoveryPlan.status as RecoveryPlanStatus}
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Prior balance
                </div>
                <div className="tabular-nums">
                  {formatCurrency(Number(activeRecoveryPlan.originalBalance))}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Forgive on complete
                </div>
                <div className="tabular-nums text-emerald-600 font-semibold">
                  {formatCurrency(Number(activeRecoveryPlan.forgivenessAmount))}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Starts
                </div>
                <div>{formatDate(activeRecoveryPlan.startDate)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Ends
                </div>
                <div>{formatDate(activeRecoveryPlan.endDate)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes & activity — general + plan-linked notes in one feed. */}
      <TenantNotesPanel tenantId={tenant.id} />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6">
          {/* Contact Info */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${tenant.user.email}`} className="text-primary hover:underline">{tenant.user.email}</a>
              </div>
              {tenant.user.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${tenant.user.phone}`} className="hover:underline">{tenant.user.phone}</a>
                </div>
              )}
              {tenant.emergencyContactName && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-1">Emergency Contact</p>
                  <p>{tenant.emergencyContactName}</p>
                  {tenant.emergencyContactPhone && <p className="text-muted-foreground">{tenant.emergencyContactPhone}</p>}
                </div>
              )}
              <div className="pt-2 border-t text-xs text-muted-foreground">
                Account created {formatDate(tenant.user.createdAt)}
              </div>
            </CardContent>
          </Card>

          {/* Lease Info */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Lease
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {activeLease ? (
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-muted-foreground">Start</span><span>{formatDate(activeLease.startDate)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">End</span><span>{formatDate(activeLease.endDate)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Rent</span><span>{formatCurrency(Number(activeLease.rentAmount))}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Status</span><StatusBadge status={activeLease.status} /></div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-2">No active lease</p>
                  <Link href={`/dashboard/leases/new?tenantId=${tenant.id}&unitId=${tenant.unitId}`}>
                    <Button size="sm" variant="outline">Create Lease</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Methods */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                Payment Methods
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {cardDisplay ? (
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span>{cardDisplay}</span>
                  {tenant.paymentMethodType === "card" && <span className="text-xs text-emerald-500">Default</span>}
                </div>
              ) : (
                <p className="text-muted-foreground">No card on file</p>
              )}
              {achDisplay ? (
                <div className="flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-muted-foreground" />
                  <span>{achDisplay}</span>
                  {tenant.paymentMethodType === "ach" && <span className="text-xs text-emerald-500">Default</span>}
                </div>
              ) : (
                <p className="text-muted-foreground">No bank account on file</p>
              )}
            </CardContent>
          </Card>

          {/* Property */}
          {tenant.unit && (
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Property
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <Link href={`/dashboard/properties/${tenant.unit.property.id}`} className="font-medium text-primary hover:underline">
                  {tenant.unit.property.name}
                </Link>
                <p className="text-muted-foreground">
                  {tenant.unit.property.address}, {tenant.unit.property.city}, {tenant.unit.property.state} {tenant.unit.property.zip}
                </p>
                <p>Unit {tenant.unit.unitNumber}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Balance Management */}
          <BalanceManager
            tenantId={tenant.id}
            payments={tenant.payments.map((p) => ({
              id: p.id,
              amount: Number(p.amount),
              type: p.type,
              status: p.status,
              description: p.description,
              dueDate: p.dueDate.toISOString(),
              paidAt: p.paidAt?.toISOString() || null,
              paymentMethod: p.paymentMethod,
              createdAt: p.createdAt.toISOString(),
              expenseId: expensePaymentMap.get(p.id) || null,
            }))}
          />

          {/* Recent Payments */}
          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Recent Payments</CardTitle>
              <Link href={`/dashboard/payments?tenantId=${tenant.id}`}>
                <Button variant="ghost" size="sm" className="text-xs">View All</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {tenant.payments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No payments yet</p>
              ) : (
                <CollapsibleList
                  label="payments"
                  initialCount={10}
                  items={tenant.payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                      <div>
                        {expensePaymentMap.get(p.id) ? (
                          <a href={`/dashboard/expenses?highlight=${expensePaymentMap.get(p.id)}`} className="font-medium text-primary hover:underline">{p.description || p.type}</a>
                        ) : (
                          <span className="font-medium">{p.description || p.type}</span>
                        )}
                        <span className="text-muted-foreground ml-2 text-xs">
                          {p.paidAt ? formatDate(p.paidAt) : formatDate(p.dueDate)}
                        </span>
                        {p.paymentMethod && (
                          <span className="text-muted-foreground ml-2 text-xs">
                            {p.paymentMethod === "card" && p.cardLast4 ? "•••• " + p.cardLast4 : p.paymentMethod === "ach" && p.achLast4 ? "ACH •••• " + p.achLast4 : p.paymentMethod.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={p.status} />
                        <span className={cn("font-medium", p.status === "FAILED" ? "text-red-500" : "")}>{formatCurrency(Number(p.amount))}</span>
                      </div>
                    </div>
                  ))}
                />
              )}
            </CardContent>
          </Card>

          {/* Expenses */}
          <TenantExpenses
            tenantId={tenant.id}
            propertyId={tenant.unit?.property.id || ""}
            unitId={tenant.unitId || ""}
            expenses={tenant.expenses.map((e) => ({
              id: e.id,
              description: e.description,
              amount: Number(e.amount),
              date: e.date.toISOString(),
              status: e.status || "PENDING",
              payableBy: e.payableBy || "OWNER",
              category: e.category,
            }))}
          />

          {/* Documents */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tenant.tenantDocuments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No documents on file
                </p>
              ) : (
                <div className="space-y-2">
                  {tenant.tenantDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {doc.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            <span className="capitalize">
                              {doc.type.toLowerCase().replace(/_/g, " ")}
                            </span>
                            {doc.uploadedAt && (
                              <span>
                                {" \u00b7 "}
                                {new Date(doc.uploadedAt).toLocaleDateString()}
                              </span>
                            )}
                            {doc.source === "APPLICATION" && (
                              <span> &middot; From application</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted shrink-0"
                      >
                        View
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Parking */}
          <TenantParkingSection
            tenantId={tenant.id}
            tenantUnitId={tenant.unitId}
            propertyId={tenant.unit?.property.id || null}
            assignments={tenant.parkingAssignments.map((a) => ({
              id: a.id,
              isIncluded: a.isIncluded,
              monthlyCharge: a.monthlyCharge,
              vehicleMake: a.vehicleMake,
              vehicleModel: a.vehicleModel,
              vehicleColor: a.vehicleColor,
              vehicleYear: a.vehicleYear,
              licensePlate: a.licensePlate,
              licensePlateState: a.licensePlateState,
              space: {
                number: a.space.number,
                type: a.space.type,
                level: a.space.level,
                lot: { name: a.space.lot.name, type: a.space.lot.type },
              },
            }))}
            roommates={roommates.map((rm) => ({
              id: rm.id,
              name: rm.user?.name || "Tenant",
              splitPercentage: rm.splitPercent,
            }))}
          />

          {/* Eviction Tracker */}
          <EvictionTracker
            tenantId={tenant.id}
            tenantName={tenant.user.name}
            propertyName={tenant.unit?.property.name || ""}
            unitNumber={tenant.unit?.unitNumber || ""}
          />
        </div>
      </div>
    </div>
  );
}

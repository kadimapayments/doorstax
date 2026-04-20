import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { formatCurrency, cn } from "@/lib/utils";
import { Plus, Home, MapPin, ArrowLeft, Pencil, DollarSign, TrendingUp, Receipt, Percent, Info, User, Phone, Mail } from "lucide-react";
import { PropertyUnitsSection } from "@/components/property/property-units-section";
import { LateFeePolicyCard } from "@/components/property/late-fee-policy-card";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const property = await db.property.findUnique({
    where: { id },
    select: { name: true },
  });
  return { title: property?.name || "Property" };
}

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("PM");
  const { id } = await params;

  const property = await db.property.findFirst({
    where: { id, landlordId: user.id },
    include: {
      units: {
        include: {
          tenantProfiles: {
            include: { user: { select: { name: true, email: true } } },
          },
        },
        orderBy: { unitNumber: "asc" },
      },
      owner: {
        select: {
          name: true,
          email: true,
          phone: true,
          feeSchedule: { select: { name: true } },
        },
      },
      feeSchedule: { select: { name: true } },
    },
  });

  if (!property) notFound();

  // Fetch financial data
  const [incomeResult, expenseResult, expensesByCategory] = await Promise.all([
    db.payment.aggregate({
      where: {
        unit: { propertyId: id },
        landlordId: user.id,
        status: "COMPLETED",
      },
      _sum: { amount: true },
    }),
    db.expense.aggregate({
      where: { propertyId: id, landlordId: user.id },
      _sum: { amount: true },
    }),
    db.expense.groupBy({
      by: ["category"],
      where: { propertyId: id, landlordId: user.id },
      _sum: { amount: true },
    }),
  ]);

  // Recent expenses for the Expenses table
  const recentExpenses = await db.expense.findMany({
    where: { propertyId: id, landlordId: user.id },
    include: {
      unit: { select: { unitNumber: true } },
      tenant: { include: { user: { select: { name: true } } } },
    },
    orderBy: { date: "desc" },
    take: 10,
  });
  const totalExpenseCount = await db.expense.count({
    where: { propertyId: id, landlordId: user.id },
  });

  const totalIncome = Number(incomeResult._sum.amount || 0);
  const totalExpenses = Number(expenseResult._sum.amount || 0);
  const netIncome = totalIncome - totalExpenses;
  const purchasePrice = property.purchasePrice ? Number(property.purchasePrice) : null;
  const roi = purchasePrice && purchasePrice > 0 ? (netIncome / purchasePrice) * 100 : null;

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/properties"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Properties
      </Link>

      <PageHeader
        title={property.name}
        description={`${property.address}, ${property.city}, ${property.state} ${property.zip}`}
        actions={
          <>
            <Link href={`/dashboard/properties/${property.id}/edit`}>
              <Button variant="outline">
                <Pencil className="mr-2 h-4 w-4" />
                Edit Property
              </Button>
            </Link>
            <Link href={`/dashboard/properties/${property.id}/units/new`}>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Unit
              </Button>
            </Link>
          </>
        }
      />

      {/* Property Photos */}
      {property.photos && property.photos.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="flex gap-2 overflow-x-auto p-2">
            {property.photos.map((photo: string, i: number) => (
              <div
                key={i}
                className="relative h-48 w-72 flex-shrink-0 overflow-hidden rounded-md"
              >
                <Image
                  src={photo}
                  alt={`${property.name} photo ${i + 1}`}
                  fill
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Owner Info */}
      {property.owner && (
        <div className="rounded-lg border bg-card px-4 py-3 flex items-center justify-between text-sm">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{property.owner.name}</span>
            </div>
            {property.owner.phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-3.5 w-3.5" />
                <span>{property.owner.phone}</span>
              </div>
            )}
            {property.owner.email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                <span>{property.owner.email}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Fee Schedule: {property.feeSchedule?.name || property.owner.feeSchedule?.name || "Default"}</span>
          </div>
        </div>
      )}

      {/* Google Maps */}
      <div className="overflow-hidden rounded-lg border border-border">
        <iframe
          src={`https://maps.google.com/maps?q=${encodeURIComponent(`${property.address}, ${property.city}, ${property.state} ${property.zip}`)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
          width="100%"
          height="300"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="Property Location"
        />
      </div>

      {property.units.length === 0 ? (
        <>
          <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <Info className="h-5 w-5 shrink-0 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">Next step: Add units to your property</p>
              <p className="text-sm text-muted-foreground">
                Units represent individual rental spaces. Add at least one unit to start assigning tenants and collecting rent.
              </p>
            </div>
            <Link href={`/dashboard/properties/${property.id}/units/new`}>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Unit
              </Button>
            </Link>
          </div>
          <EmptyState
            icon={<Home className="h-12 w-12" />}
            title="No units yet"
            description="Add units to this property to start managing tenants and collecting rent."
            action={
              <Link href={`/dashboard/properties/${property.id}/units/new`}>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Unit
                </Button>
              </Link>
            }
          />
        </>
      ) : (
        <PropertyUnitsSection
          propertyId={property.id}
          units={property.units.map((u) => ({
            id: u.id,
            unitNumber: u.unitNumber,
            rentAmount: Number(u.rentAmount),
            bedrooms: u.bedrooms,
            bathrooms: u.bathrooms,
            sqft: u.sqft,
            status: u.status,
            tenantProfiles: u.tenantProfiles.map((tp) => ({
              user: tp.user ? { name: tp.user.name, email: tp.user.email } : null,
            })),
          }))}
        />
      )}

      {/* Late Fee Policy */}
      <LateFeePolicyCard propertyId={property.id} />

      {/* Property Expenses */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Receipt className="h-5 w-5 text-muted-foreground" />
            Expenses
            <span className="text-sm font-normal text-muted-foreground">
              ({totalExpenseCount} total — {formatCurrency(totalExpenses)})
            </span>
          </h2>
          <Link href={`/dashboard/expenses/new?propertyId=${property.id}`}>
            <Button variant="outline" size="sm">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Expense
            </Button>
          </Link>
        </div>

        {recentExpenses.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No expenses recorded for this property.
          </div>
        ) : (
          <div className="rounded-lg border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Description</th>
                  <th className="px-4 py-2.5 font-medium">Category</th>
                  <th className="px-4 py-2.5 font-medium">Unit</th>
                  <th className="px-4 py-2.5 font-medium">Payable By</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentExpenses.map((exp) => (
                  <tr key={exp.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-2.5">{new Date(exp.date).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5">
                      <span className="font-medium">{exp.description}</span>
                      {exp.vendor && <span className="text-muted-foreground ml-1">({exp.vendor})</span>}
                    </td>
                    <td className="px-4 py-2.5 capitalize text-muted-foreground">{exp.category.toLowerCase().replace("_", " ")}</td>
                    <td className="px-4 py-2.5">{exp.unit?.unitNumber || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                        exp.payableBy === "TENANT" ? "bg-amber-500/10 text-amber-500" :
                        exp.payableBy === "OWNER" ? "bg-blue-500/10 text-blue-500" :
                        exp.payableBy === "PM" ? "bg-purple-500/10 text-purple-500" :
                        exp.payableBy === "INSURANCE" ? "bg-emerald-500/10 text-emerald-500" :
                        "bg-muted text-muted-foreground"
                      )}>
                        {exp.payableBy === "PM" ? "I Pay" : exp.payableBy?.charAt(0) + exp.payableBy?.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                        exp.status === "PAID" ? "bg-emerald-500/10 text-emerald-500" :
                        exp.status === "INVOICED" ? "bg-amber-500/10 text-amber-500" :
                        exp.status === "PENDING" ? "bg-blue-500/10 text-blue-500" :
                        exp.status === "APPROVED" ? "bg-emerald-500/10 text-emerald-500" :
                        "bg-muted text-muted-foreground"
                      )}>
                        {exp.status?.charAt(0) + exp.status?.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(Number(exp.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalExpenseCount > 10 && (
              <div className="border-t px-4 py-2 text-center">
                <Link href={`/dashboard/expenses?propertyId=${property.id}`} className="text-xs text-primary hover:underline">
                  View all {totalExpenseCount} expenses
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Financial Summary */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Financial Summary</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Total Income"
            value={formatCurrency(totalIncome)}
            icon={<DollarSign className="h-4 w-4" />}
          />
          <MetricCard
            label="Total Expenses"
            value={formatCurrency(totalExpenses)}
            icon={<Receipt className="h-4 w-4" />}
          />
          <MetricCard
            label="Net Income"
            value={formatCurrency(netIncome)}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          {roi !== null && (
            <MetricCard
              label="ROI"
              value={`${roi.toFixed(1)}%`}
              icon={<Percent className="h-4 w-4" />}
            />
          )}
        </div>

        {expensesByCategory.length > 0 && (
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">Expenses by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {expensesByCategory.map((row) => (
                  <div
                    key={row.category}
                    className="flex justify-between text-sm"
                  >
                    <span className="text-muted-foreground">
                      {row.category.charAt(0) + row.category.slice(1).toLowerCase()}
                    </span>
                    <span className="font-medium">
                      {formatCurrency(Number(row._sum.amount || 0))}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

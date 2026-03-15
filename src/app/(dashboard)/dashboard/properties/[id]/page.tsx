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
import { formatCurrency } from "@/lib/utils";
import { Plus, Home, MapPin, ArrowLeft, Pencil, DollarSign, TrendingUp, Receipt, Percent, Info } from "lucide-react";

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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {property.units.map((unit) => {
            const tenant = unit.tenantProfiles[0]?.user;
            return (
              <Link
                key={unit.id}
                href={`/dashboard/properties/${property.id}/units/${unit.id}`}
              >
                <Card className="border-border transition-colors hover:border-border-hover">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Unit {unit.unitNumber}</h3>
                      <StatusBadge status={unit.status} />
                    </div>
                    <p className="mt-2 text-lg font-bold">
                      {formatCurrency(Number(unit.rentAmount))}
                      <span className="text-sm font-normal text-muted-foreground">
                        /mo
                      </span>
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                      {unit.bedrooms !== null && (
                        <span>{unit.bedrooms} bed</span>
                      )}
                      {unit.bathrooms !== null && (
                        <span>&middot; {unit.bathrooms} bath</span>
                      )}
                      {unit.sqft !== null && (
                        <span>&middot; {unit.sqft} sqft</span>
                      )}
                    </div>
                    {tenant ? (
                      <p className="mt-3 text-sm">
                        <span className="text-muted-foreground">Tenant:</span>{" "}
                        {tenant.name}
                      </p>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">
                        No tenant assigned
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
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

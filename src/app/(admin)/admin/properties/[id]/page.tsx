import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdminPermission } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Building2,
  Users,
  Percent,
  DollarSign,
  ArrowLeft,
  MapPin,
  Home,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { PropertyUnitsTable } from "@/components/admin/property-units-table";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const property = await db.property.findUnique({
    where: { id },
    select: { name: true },
  });
  return { title: property ? `${property.name} — Admin` : "Property — Admin" };
}

export default async function AdminPropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPermission("admin:properties");
  const { id } = await params;

  const property = await db.property.findUnique({
    where: { id },
    include: {
      landlord: { select: { id: true, name: true, email: true } },
      units: {
        include: {
          tenantProfiles: {
            where: { status: "ACTIVE" },
            include: { user: { select: { name: true, email: true } } },
          },
        },
        orderBy: { unitNumber: "asc" },
      },
      expenses: {
        orderBy: { date: "desc" },
        take: 10,
      },
      leases: {
        where: { status: "ACTIVE" },
        include: {
          tenant: { include: { user: { select: { name: true } } } },
          unit: { select: { unitNumber: true } },
        },
        orderBy: { startDate: "desc" },
      },
    },
  });

  if (!property) return notFound();

  const totalUnits = property.units.length;
  const occupiedUnits = property.units.filter((u) => u.status === "OCCUPIED").length;
  const occupancy = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
  const totalRent = property.units.reduce((s, u) => s + Number(u.rentAmount), 0);
  const avgRent = totalUnits > 0 ? Math.round(totalRent / totalUnits) : 0;
  const totalExpenses = property.expenses.reduce((s, e) => s + Number(e.amount), 0);

  const unitRows = property.units.map((u) => ({
    id: u.id,
    unitNumber: u.unitNumber,
    bedrooms: u.bedrooms,
    bathrooms: u.bathrooms,
    sqft: u.sqft,
    rent: Number(u.rentAmount),
    status: u.status,
    tenantName: u.tenantProfiles[0]?.user.name ?? null,
    tenantEmail: u.tenantProfiles[0]?.user.email ?? null,
    listingEnabled: u.listingEnabled,
    applicationsEnabled: u.applicationsEnabled,
  }));

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/properties"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Properties
        </Link>
        <PageHeader
          title={property.name}
          description={`${property.address}, ${property.city}, ${property.state} ${property.zip}`}
        />
      </div>

      {/* Property Info */}
      <div className="rounded-lg border border-border p-6 card-glow space-y-4">
        <h2 className="text-lg font-semibold">Property Details</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-sm text-muted-foreground">Type</p>
            <p className="font-medium">{property.propertyType.replace("_", " ")}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Landlord</p>
            <Link
              href={`/admin/landlords/${property.landlord.id}`}
              className="font-medium text-primary hover:underline"
            >
              {property.landlord.name}
            </Link>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Location</p>
            <p className="font-medium flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {property.city}, {property.state}
            </p>
          </div>
          {property.purchasePrice && (
            <div>
              <p className="text-sm text-muted-foreground">Purchase Price</p>
              <p className="font-medium">{formatCurrency(Number(property.purchasePrice))}</p>
            </div>
          )}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          label="Total Units"
          value={totalUnits}
          icon={<Building2 className="h-4 w-4" />}
        />
        <MetricCard
          label="Occupied"
          value={occupiedUnits}
          icon={<Users className="h-4 w-4" />}
        />
        <MetricCard
          label="Occupancy"
          value={`${occupancy}%`}
          icon={<Percent className="h-4 w-4" />}
        />
        <MetricCard
          label="Monthly Rent"
          value={formatCurrency(totalRent)}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <MetricCard
          label="Avg Rent"
          value={formatCurrency(avgRent)}
          icon={<Home className="h-4 w-4" />}
        />
        <MetricCard
          label="Expenses (Recent)"
          value={formatCurrency(totalExpenses)}
          icon={<DollarSign className="h-4 w-4" />}
        />
      </div>

      {/* Units Table */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Units</h2>
        <PropertyUnitsTable rows={unitRows} />
      </div>

      {/* Active Leases */}
      {property.leases.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Active Leases</h2>
          <div className="rounded-lg border border-border card-glow overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tenant</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Unit</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Rent</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Start</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">End</th>
                </tr>
              </thead>
              <tbody>
                {property.leases.map((l) => (
                  <tr key={l.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{l.tenant.user.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{l.unit.unitNumber}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(Number(l.rentAmount))}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(l.startDate)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(l.endDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Expenses */}
      {property.expenses.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Recent Expenses</h2>
          <div className="rounded-lg border border-border card-glow overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Description</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Vendor</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
                </tr>
              </thead>
              <tbody>
                {property.expenses.map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(e.date)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{e.category.replace("_", " ")}</Badge>
                    </td>
                    <td className="px-4 py-3">{e.description}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.vendor ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(Number(e.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

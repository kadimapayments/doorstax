import { requireAdminPermission } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { formatCurrency } from "@/lib/utils";
import { MapPin, TrendingUp, Building2, BarChart3 } from "lucide-react";
import { GeographicTable, type GeoRow } from "@/components/admin/geographic-table";

export const metadata = { title: "Market Insights — Admin" };

export default async function AdminInsightsPage() {
  await requireAdminPermission("admin:insights");

  // Fetch all properties with units
  const properties = await db.property.findMany({
    select: {
      id: true,
      state: true,
      city: true,
      units: { select: { id: true, status: true, rentAmount: true } },
    },
  });

  // Fetch completed + failed payment counts by property
  const payments = await db.payment.findMany({
    where: { status: { in: ["COMPLETED", "FAILED"] } },
    select: { amount: true, status: true, unitId: true, paymentMethod: true },
  });

  // Build a map of unitId → propertyId for payment lookups
  const unitToProperty = new Map<string, string>();
  for (const p of properties) {
    for (const u of p.units) {
      unitToProperty.set(u.id, p.id);
    }
  }

  // Aggregate by state+city
  const geoMap = new Map<string, {
    state: string;
    city: string;
    properties: Set<string>;
    units: number;
    occupiedUnits: number;
    totalRent: number;
    rentCount: number;
    completedVolume: number;
    completedCount: number;
    failedCount: number;
    cardCount: number;
    achCount: number;
  }>();

  for (const p of properties) {
    const key = `${p.state || "Unknown"}|${p.city || "Unknown"}`;
    const entry = geoMap.get(key) || {
      state: p.state || "Unknown",
      city: p.city || "Unknown",
      properties: new Set<string>(),
      units: 0,
      occupiedUnits: 0,
      totalRent: 0,
      rentCount: 0,
      completedVolume: 0,
      completedCount: 0,
      failedCount: 0,
      cardCount: 0,
      achCount: 0,
    };

    entry.properties.add(p.id);
    for (const u of p.units) {
      entry.units++;
      if (u.status === "OCCUPIED") entry.occupiedUnits++;
      if (u.rentAmount) {
        entry.totalRent += Number(u.rentAmount);
        entry.rentCount++;
      }
    }
    geoMap.set(key, entry);
  }

  // Add payment data
  for (const pay of payments) {
    const propId = unitToProperty.get(pay.unitId);
    if (!propId) continue;
    // Find which geo entry this property belongs to
    const prop = properties.find(p => p.id === propId);
    if (!prop) continue;
    const key = `${prop.state || "Unknown"}|${prop.city || "Unknown"}`;
    const entry = geoMap.get(key);
    if (!entry) continue;

    if (pay.status === "COMPLETED") {
      entry.completedVolume += Number(pay.amount);
      entry.completedCount++;
      if (pay.paymentMethod === "card") entry.cardCount++;
      else if (pay.paymentMethod === "ach") entry.achCount++;
    } else if (pay.status === "FAILED") {
      entry.failedCount++;
    }
  }

  // Convert to rows
  const rows: GeoRow[] = Array.from(geoMap.values())
    .map((entry) => {
      const totalPayments = entry.completedCount + entry.failedCount;
      const occupancyRate = entry.units > 0 ? Math.round((entry.occupiedUnits / entry.units) * 100) : 0;
      const avgRent = entry.rentCount > 0 ? Math.round(entry.totalRent / entry.rentCount) : 0;
      const failureRate = totalPayments > 0 ? Math.round((entry.failedCount / totalPayments) * 100) : 0;

      // Categorize
      let status: "hot" | "normal" | "suffering" = "normal";
      if (occupancyRate >= 85 && failureRate < 5) {
        status = "hot";
      } else if (occupancyRate < 60 || failureRate > 15) {
        status = "suffering";
      }

      const totalPayMethodCount = entry.cardCount + entry.achCount;
      const cardPercent = totalPayMethodCount > 0 ? Math.round((entry.cardCount / totalPayMethodCount) * 100) : 0;

      return {
        state: entry.state,
        city: entry.city,
        properties: entry.properties.size,
        units: entry.units,
        occupiedUnits: entry.occupiedUnits,
        occupancyRate,
        avgRent,
        volume: entry.completedVolume,
        failureRate,
        cardPercent,
        status,
      };
    })
    .sort((a, b) => b.volume - a.volume);

  const totalMarkets = rows.length;
  const avgOccupancy = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.occupancyRate, 0) / rows.length) : 0;
  const avgRentAll = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.avgRent, 0) / rows.length) : 0;
  const hotAreas = rows.filter((r) => r.status === "hot");
  const sufferingAreas = rows.filter((r) => r.status === "suffering");

  return (
    <div className="space-y-8">
      <PageHeader title="Market Insights" description="Geographic analytics across all properties." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total Markets" value={totalMarkets} icon={<MapPin className="h-4 w-4" />} />
        <MetricCard label="Avg Occupancy" value={`${avgOccupancy}%`} icon={<Building2 className="h-4 w-4" />} />
        <MetricCard label="Avg Rent" value={formatCurrency(avgRentAll)} icon={<BarChart3 className="h-4 w-4" />} />
        <MetricCard
          label="Hot Areas"
          value={hotAreas.length}
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">All Markets</h2>
        <GeographicTable rows={rows} />
      </section>

      {hotAreas.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-emerald-500">Hot Areas</h2>
          <p className="text-sm text-muted-foreground">High occupancy, low failure rate — performing well.</p>
          <GeographicTable rows={hotAreas} />
        </section>
      )}

      {sufferingAreas.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-destructive">Suffering Areas</h2>
          <p className="text-sm text-muted-foreground">Low occupancy or high failure rates — need attention.</p>
          <GeographicTable rows={sufferingAreas} />
        </section>
      )}
    </div>
  );
}

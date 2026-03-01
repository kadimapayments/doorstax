import Link from "next/link";
import { requireRole } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Plus, MapPin, FileSpreadsheet, Home, Landmark, Store } from "lucide-react";
import { PropertySearch, type PropertyData } from "@/components/properties/property-search";

const propertyTypeConfig: Record<string, { label: string; icon: typeof Home }> = {
  SINGLE_FAMILY: { label: "Single Family", icon: Home },
  MULTIFAMILY: { label: "Multifamily", icon: Building2 },
  OFFICE: { label: "Office", icon: Landmark },
  COMMERCIAL: { label: "Commercial", icon: Store },
};

export const metadata = { title: "Properties" };

export default async function PropertiesPage() {
  const user = await requireRole("LANDLORD");

  const properties = await db.property.findMany({
    where: { landlordId: user.id },
    include: {
      units: {
        select: { id: true, unitNumber: true, status: true, rentAmount: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Properties"
        description="Manage your properties and units."
        actions={
          <div className="flex gap-2">
            <Link href="/dashboard/properties/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Property
              </Button>
            </Link>
            <Link href="/dashboard/properties/import">
              <Button variant="outline">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Import CSV
              </Button>
            </Link>
          </div>
        }
      />

      {properties.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-12 w-12" />}
          title="No properties yet"
          description="Add your first property to start managing units and tenants."
          action={
            <Link href="/dashboard/properties/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Property
              </Button>
            </Link>
          }
        />
      ) : (
        <PropertySearch
          properties={properties.map((p) => ({
            id: p.id,
            name: p.name,
            address: p.address,
            city: p.city,
            state: p.state,
            zip: p.zip,
            propertyType: p.propertyType,
            units: p.units.map((u) => ({
              id: u.id,
              unitNumber: u.unitNumber,
              status: u.status,
              rentAmount: Number(u.rentAmount),
            })),
          })) as PropertyData[]}
        >
          {(filtered) => (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((property) => {
                const occupied = property.units.filter(
                  (u) => u.status === "OCCUPIED"
                ).length;
                const total = property.units.length;
                const totalRent = property.units.reduce(
                  (sum, u) => sum + Number(u.rentAmount),
                  0
                );

                const typeInfo = propertyTypeConfig[property.propertyType] || propertyTypeConfig.MULTIFAMILY;
                const TypeIcon = typeInfo.icon;

                return (
                  <Link
                    key={property.id}
                    href={`/dashboard/properties/${property.id}`}
                  >
                    <Card className="border-border transition-colors hover:border-border-hover">
                      <CardContent className="p-5">
                        <div className="flex items-center gap-2">
                          <TypeIcon className="h-4 w-4 text-muted-foreground" />
                          <h3 className="font-semibold">{property.name}</h3>
                        </div>
                        <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {property.address}, {property.city}, {property.state}{" "}
                          {property.zip}
                        </p>
                        <span className="text-xs text-muted-foreground">{typeInfo.label}</span>
                        <div className="mt-4 flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {total} unit{total !== 1 ? "s" : ""}
                          </span>
                          <StatusBadge
                            status={
                              total === 0
                                ? "EMPTY"
                                : occupied === total
                                  ? "OCCUPIED"
                                  : "AVAILABLE"
                            }
                          />
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {occupied}/{total} occupied &middot; $
                          {totalRent.toLocaleString()}/mo total rent
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </PropertySearch>
      )}
    </div>
  );
}

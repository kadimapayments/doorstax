import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Plus, Home, MapPin } from "lucide-react";

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
  const user = await requireRole("LANDLORD");
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={property.name}
        description={`${property.address}, ${property.city}, ${property.state} ${property.zip}`}
        actions={
          <Link href={`/dashboard/properties/${property.id}/units/new`}>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Unit
            </Button>
          </Link>
        }
      />

      {property.units.length === 0 ? (
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
    </div>
  );
}

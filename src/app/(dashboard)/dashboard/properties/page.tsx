export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth-utils";
import { getTeamContext, can } from "@/lib/team-context";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Building2, Plus, FileSpreadsheet, ArrowLeftRight } from "lucide-react";
import { PropertySearch } from "@/components/properties/property-search";

export const metadata = { title: "Properties" };

export default async function PropertiesPage() {
  const user = await requireRole("PM");
  const ctx = await getTeamContext(user.id);
  if (!can(ctx, "properties:read")) redirect("/dashboard");

  const properties = await db.property.findMany({
    where: { landlordId: ctx.landlordId },
    include: {
      units: {
        select: { id: true, unitNumber: true, status: true, rentAmount: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const serialized = properties.map((p) => ({
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
  }));

  const canWrite = can(ctx, "properties:write");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Properties"
        description="Manage your properties and units."
        actions={
          canWrite ? (
            <div className="flex gap-2">
              <Link href="/dashboard/properties/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Property
                </Button>
              </Link>
              <Link href="/dashboard/properties/migrate">
                <Button variant="outline">
                  <ArrowLeftRight className="mr-2 h-4 w-4" />
                  Migrate
                </Button>
              </Link>
              <Link href="/dashboard/properties/import">
                <Button variant="outline">
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Import CSV
                </Button>
              </Link>
            </div>
          ) : undefined
        }
      />

      {serialized.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-12 w-12" />}
          title="No properties yet"
          description="Add your first property to start managing units and tenants."
          action={
            canWrite ? (
              <Link href="/dashboard/properties/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Property
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <PropertySearch properties={serialized} />
      )}
    </div>
  );
}

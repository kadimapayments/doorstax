export const dynamic = "force-dynamic";

import { requireAdminPermission } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { ApplicationsTable } from "@/components/admin/applications-table";

export const metadata = { title: "Applications — Admin" };

export default async function AdminApplicationsPage() {
  await requireAdminPermission("admin:applications");

  const applications = await db.application.findMany({
    include: {
      unit: {
        select: {
          unitNumber: true,
          property: {
            select: {
              name: true,
              landlord: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = applications.map((a) => ({
    id: a.id,
    applicant: a.name,
    email: a.email,
    phone: a.phone || "",
    property: a.unit.property.name,
    unit: a.unit.unitNumber,
    landlordId: a.unit.property.landlord.id,
    landlordName: a.unit.property.landlord.name,
    status: a.status,
    date: a.createdAt.toISOString(),
  }));

  const landlords = Array.from(
    new Map(rows.map((r) => [r.landlordId, r.landlordName])).entries()
  ).map(([id, name]) => ({ id, name }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Applications"
        description="All rental applications across the platform."
      />
      <ApplicationsTable rows={rows} landlords={landlords} />
    </div>
  );
}

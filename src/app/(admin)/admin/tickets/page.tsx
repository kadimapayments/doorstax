export const dynamic = "force-dynamic";

import { requireAdminPermission } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { TicketsTable } from "@/components/admin/tickets-table";

export const metadata = { title: "Tickets — Admin" };

export default async function AdminTicketsPage() {
  await requireAdminPermission("admin:tickets");

  const tickets = await db.serviceTicket.findMany({
    include: {
      tenant: { include: { user: { select: { name: true } } } },
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

  const rows = tickets.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    submitter: t.tenant.user.name,
    landlordId: t.unit.property.landlord.id,
    landlordName: t.unit.property.landlord.name,
    property: t.unit.property.name,
    unit: t.unit.unitNumber,
    category: t.category,
    priority: t.priority,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
  }));

  const landlords = Array.from(
    new Map(rows.map((r) => [r.landlordId, r.landlordName])).entries()
  ).map(([id, name]) => ({ id, name }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tickets"
        description="All service tickets across the platform."
      />
      <TicketsTable rows={rows} landlords={landlords} />
    </div>
  );
}

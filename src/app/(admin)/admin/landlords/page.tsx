import { requireRole } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { LandlordsTable } from "@/components/admin/landlords-table";

export const metadata = { title: "Landlords — Admin" };

export default async function AdminLandlordsPage() {
  await requireRole("ADMIN");

  const landlords = await db.user.findMany({
    where: { role: "LANDLORD" },
    include: {
      properties: {
        include: { units: { select: { id: true } } },
      },
      payments: {
        where: { status: "COMPLETED" },
        select: { amount: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = landlords.map((l) => ({
    id: l.id,
    name: l.name,
    email: l.email,
    properties: l.properties.length,
    units: l.properties.reduce((s, p) => s + p.units.length, 0),
    volume: l.payments.reduce((s, p) => s + Number(p.amount), 0),
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Landlords" description="All registered landlords." />
      <LandlordsTable rows={rows} />
    </div>
  );
}

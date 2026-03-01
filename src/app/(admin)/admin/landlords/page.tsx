import { requireRole } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { formatCurrency, formatDate } from "@/lib/utils";

export const metadata = { title: "Landlords — Admin" };

interface LandlordRow {
  id: string;
  name: string;
  email: string;
  properties: number;
  units: number;
  volume: number;
  createdAt: Date;
}

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

  const rows: LandlordRow[] = landlords.map((l) => ({
    id: l.id,
    name: l.name,
    email: l.email,
    properties: l.properties.length,
    units: l.properties.reduce((s, p) => s + p.units.length, 0),
    volume: l.payments.reduce((s, p) => s + Number(p.amount), 0),
    createdAt: l.createdAt,
  }));

  const columns: Column<LandlordRow>[] = [
    { key: "name", header: "Name", cell: (row) => <span className="font-medium">{row.name}</span> },
    { key: "email", header: "Email", cell: (row) => <span className="text-muted-foreground">{row.email}</span> },
    { key: "properties", header: "Properties", cell: (row) => row.properties },
    { key: "units", header: "Units", cell: (row) => row.units },
    { key: "volume", header: "Volume", cell: (row) => formatCurrency(row.volume) },
    { key: "joined", header: "Joined", cell: (row) => formatDate(row.createdAt) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Landlords" description="All registered landlords." />
      <DataTable columns={columns} data={rows} emptyMessage="No landlords yet." />
    </div>
  );
}

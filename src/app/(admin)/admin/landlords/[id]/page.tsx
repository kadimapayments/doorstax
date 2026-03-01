import { requireRole } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { notFound } from "next/navigation";
import { Building2, Home, DollarSign, AlertTriangle } from "lucide-react";
import { LandlordPaymentsTable } from "@/components/admin/landlord-payments-table";

export const metadata = { title: "Landlord Detail — Admin" };

export default async function AdminLandlordDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("ADMIN");
  const { id } = await params;

  const landlord = await db.user.findUnique({
    where: { id, role: "LANDLORD" },
    include: {
      properties: {
        include: { units: { select: { id: true, status: true, rentAmount: true } } },
      },
      payments: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          tenant: { include: { user: { select: { name: true } } } },
          unit: { select: { unitNumber: true } },
        },
      },
    },
  });

  if (!landlord) notFound();

  const allUnits = landlord.properties.flatMap((p) => p.units);
  const totalVolume = landlord.payments
    .filter((p) => p.status === "COMPLETED")
    .reduce((s, p) => s + Number(p.amount), 0);
  const failedCount = landlord.payments.filter((p) => p.status === "FAILED").length;

  const paymentRows = landlord.payments.map((p) => ({
    id: p.id,
    tenant: p.tenant.user.name,
    unit: p.unit.unitNumber,
    amount: Number(p.amount),
    status: p.status,
    date: p.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title={landlord.name}
        description={`${landlord.email} — Joined ${formatDate(landlord.createdAt)}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Properties"
          value={landlord.properties.length}
          icon={<Building2 className="h-4 w-4" />}
        />
        <MetricCard
          label="Units"
          value={allUnits.length}
          icon={<Home className="h-4 w-4" />}
        />
        <MetricCard
          label="Total Volume"
          value={formatCurrency(totalVolume)}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <MetricCard
          label="Failed Payments"
          value={failedCount}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Recent Payments</h2>
        <LandlordPaymentsTable rows={paymentRows} />
      </div>
    </div>
  );
}

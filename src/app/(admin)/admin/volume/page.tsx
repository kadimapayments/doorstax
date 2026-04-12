export const dynamic = "force-dynamic";

import { requireAdminPermission } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { VolumeFilterWrapper } from "@/components/admin/volume-filter-wrapper";
import { MonthlyVolumeDetail } from "@/components/dashboard/monthly-volume-detail";

export const metadata = { title: "Volume Analytics — Admin" };

export default async function AdminVolumePage() {
  await requireAdminPermission("admin:volume");

  const payments = await db.payment.findMany({
    where: { status: "COMPLETED" },
    select: {
      amount: true,
      paymentMethod: true,
      paidAt: true,
      createdAt: true,
      landlordId: true,
      unitId: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const landlords = await db.user.findMany({
    where: { role: "PM" },
    select: { id: true, name: true },
  });

  const units = await db.unit.findMany({
    select: { id: true, property: { select: { name: true } } },
  });
  const unitPropertyMap: Record<string, string> = {};
  for (const u of units) {
    unitPropertyMap[u.id] = u.property.name;
  }

  const serializedPayments = payments.map((p) => ({
    amount: Number(p.amount),
    paymentMethod: p.paymentMethod,
    paidAt: p.paidAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    landlordId: p.landlordId,
    unitId: p.unitId,
  }));

  return (
    <div className="space-y-8">
      <PageHeader title="Volume Analytics" description="Payment volume across all landlords." />
      <MonthlyVolumeDetail scope="admin" />
      <VolumeFilterWrapper
        payments={serializedPayments}
        landlords={landlords}
        unitPropertyMap={unitPropertyMap}
      />
    </div>
  );
}

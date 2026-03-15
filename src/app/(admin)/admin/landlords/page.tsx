import { requireAdminPermission } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { LandlordsTable } from "@/components/admin/landlords-table";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";

export const metadata = { title: "Managers — Admin" };

export default async function AdminLandlordsPage() {
  await requireAdminPermission("admin:landlords");

  const landlords = await db.user.findMany({
    where: { role: "PM" },
    include: {
      properties: {
        include: { units: { select: { id: true, status: true } } },
      },
      payments: {
        where: { status: "COMPLETED" },
        select: { amount: true },
      },
      subscription: {
        select: { status: true },
      },
      merchantApplication: {
        select: { status: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = landlords.map((l) => ({
    id: l.id,
    name: l.name,
    email: l.email,
    phone: l.phone ?? "",
    companyName: l.companyName ?? "",
    properties: l.properties.length,
    units: l.properties.reduce((s, p) => s + p.units.length, 0),
    occupiedUnits: l.properties.reduce(
      (s, p) => s + p.units.filter((u) => u.status === "OCCUPIED").length,
      0
    ),
    volume: l.payments.reduce((s, p) => s + Number(p.amount), 0),
    subscriptionStatus: l.subscription?.status ?? null,
    managerStatus: l.managerStatus,
    boardingStatus: l.merchantApplication?.status ?? null,
    hasCardOnFile: !!l.kadimaCardTokenId,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Managers"
        description="All registered managers."
        actions={
          <Link href="/admin/landlords/new">
            <Button size="sm">
              <UserPlus className="mr-2 h-4 w-4" />
              Add Manager
            </Button>
          </Link>
        }
      />
      <LandlordsTable rows={rows} />
    </div>
  );
}

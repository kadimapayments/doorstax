import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { AlertTriangle, ChevronRight } from "lucide-react";

interface TopLatePayersProps {
  landlordId: string;
  /** Optional — scope to a single property */
  propertyId?: string | null;
}

/**
 * Five tenants with the highest overdue balance (PENDING or FAILED
 * payments with a past dueDate). Renders nothing if there are none.
 */
export async function TopLatePayers({
  landlordId,
  propertyId,
}: TopLatePayersProps) {
  const overdue = await db.payment.groupBy({
    by: ["tenantId"],
    where: {
      landlordId,
      status: { in: ["PENDING", "FAILED"] },
      dueDate: { lt: new Date() },
      ...(propertyId ? { unit: { propertyId } } : {}),
    },
    _sum: { amount: true },
    _max: { dueDate: true },
    orderBy: { _sum: { amount: "desc" } },
    take: 5,
  });

  if (overdue.length === 0) return null;

  const tenantIds = overdue.map((o) => o.tenantId);
  const tenants = await db.tenantProfile.findMany({
    where: { id: { in: tenantIds } },
    select: {
      id: true,
      user: { select: { name: true, email: true } },
      unit: {
        select: { unitNumber: true, property: { select: { name: true } } },
      },
    },
  });
  const tenantById = new Map(tenants.map((t) => [t.id, t]));

  const rows = overdue
    .map((o) => {
      const t = tenantById.get(o.tenantId);
      if (!t) return null;
      const daysLate = o._max.dueDate
        ? Math.floor(
            (Date.now() - new Date(o._max.dueDate).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : 0;
      return {
        tenantId: o.tenantId,
        name: t.user?.name || "Tenant",
        unitLabel: t.unit
          ? `${t.unit.property?.name || ""} — Unit ${t.unit.unitNumber}`
          : "No unit",
        amount: Number(o._sum.amount || 0),
        daysLate,
      };
    })
    .filter((r): r is NonNullable<typeof r> => !!r);

  return (
    <Card className="card-hover border-border">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold">Top late payers</h3>
          </div>
          <Link
            href="/dashboard/unpaid"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
          >
            See all
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="space-y-2">
          {rows.map((r) => (
            <Link
              key={r.tenantId}
              href={`/dashboard/tenants/${r.tenantId}`}
              className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-muted/40 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{r.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {r.unitLabel}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold text-red-500">
                  {formatCurrency(r.amount)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {r.daysLate}d late
                </p>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

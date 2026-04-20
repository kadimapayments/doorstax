export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { toCsv, csvResponse } from "@/lib/reports/csv";

/**
 * GET /api/reports/delinquency
 *
 * Query params:
 *   propertyId?  — scope to a single property
 *   format?      — "csv" | "json" (default json)
 *
 * Returns tenants with non-zero outstanding balance plus days-past-due
 * calculated from the earliest unpaid CHARGE ledger entry this period.
 * Sorted by amount desc.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (
    !session?.user ||
    !["PM", "LANDLORD"].includes(session.user.role)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const landlordId = await getEffectiveLandlordId(session.user.id);
  const propertyId = req.nextUrl.searchParams.get("propertyId") || undefined;
  const format = req.nextUrl.searchParams.get("format") || "json";

  // Find all active tenants on this PM's portfolio, with their latest
  // ledger entry. Then filter for balance > 0 in memory.
  const tenants = await db.tenantProfile.findMany({
    where: {
      status: "ACTIVE",
      unit: {
        property: {
          landlordId,
          ...(propertyId ? { id: propertyId } : {}),
        },
      },
    },
    select: {
      id: true,
      user: { select: { name: true, email: true } },
      unit: {
        select: {
          unitNumber: true,
          dueDay: true,
          property: { select: { name: true } },
        },
      },
      ledgerEntries: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { balanceAfter: true },
      },
    },
  });

  const delinquent = tenants
    .map((t) => {
      const balance = Number(t.ledgerEntries[0]?.balanceAfter ?? 0);
      return { t, balance };
    })
    .filter((x) => x.balance > 0);

  // Enrich each with earliest unpaid charge date to compute days-past-due.
  const enriched = await Promise.all(
    delinquent.map(async ({ t, balance }) => {
      const oldestCharge = await db.ledgerEntry.findFirst({
        where: {
          tenantId: t.id,
          type: "CHARGE",
        },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true, periodKey: true },
      });
      const now = new Date();
      const dueDay = t.unit?.dueDay ?? 1;
      // Due date of the oldest-charge period's dueDay.
      let daysPastDue = 0;
      if (oldestCharge) {
        const [y, m] = oldestCharge.periodKey.split("-").map(Number);
        const dueDate = new Date(y, m - 1, dueDay);
        daysPastDue = Math.max(
          0,
          Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
        );
      }
      return {
        tenantId: t.id,
        tenant: t.user?.name || "Unknown",
        email: t.user?.email || "",
        property: t.unit?.property?.name || "",
        unit: t.unit?.unitNumber || "",
        balance: balance.toFixed(2),
        daysPastDue,
      };
    })
  );

  enriched.sort((a, b) => Number(b.balance) - Number(a.balance));

  if (format === "csv") {
    return csvResponse(
      toCsv(enriched),
      `delinquency-${new Date().toISOString().slice(0, 10)}.csv`
    );
  }

  const totalOwed = enriched.reduce((s, r) => s + Number(r.balance), 0);
  return NextResponse.json({
    rows: enriched,
    summary: {
      delinquentCount: enriched.length,
      totalOwed,
      avgDaysPastDue:
        enriched.length > 0
          ? Math.round(
              enriched.reduce((s, r) => s + r.daysPastDue, 0) / enriched.length
            )
          : 0,
    },
  });
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAdjustment, periodKeyFromDate } from "@/lib/ledger";
import { auditLog } from "@/lib/audit";

/**
 * POST /api/ledger/adjust
 * PM/admin creates a manual ledger adjustment for a tenant.
 *
 * Body: { tenantId, amount, periodKey?, description }
 * - amount > 0 = tenant owes more (debit)
 * - amount < 0 = tenant credit
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "PM" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { tenantId, amount, periodKey, description } = body as {
      tenantId?: string;
      amount?: number;
      periodKey?: string;
      description?: string;
    };

    if (!tenantId || amount === undefined || amount === 0 || !description) {
      return NextResponse.json(
        { error: "tenantId, amount (non-zero), and description are required" },
        { status: 400 }
      );
    }

    // Verify PM owns this tenant (or admin has access)
    const tenant = await db.tenantProfile.findFirst({
      where: {
        id: tenantId,
        ...(session.user.role === "PM"
          ? { unit: { property: { landlordId: session.user.id } } }
          : {}),
      },
      include: {
        unit: { select: { id: true } },
        user: { select: { name: true } },
      },
    });

    if (!tenant || !tenant.unit) {
      return NextResponse.json(
        { error: "Tenant not found or no unit assigned" },
        { status: 404 }
      );
    }

    const resolvedPeriod = periodKey || periodKeyFromDate(new Date());

    const entry = await createAdjustment({
      tenantId: tenant.id,
      unitId: tenant.unit.id,
      amount,
      periodKey: resolvedPeriod,
      description,
      createdById: session.user.id,
    });

    if (!entry) {
      return NextResponse.json(
        { error: "Failed to create adjustment" },
        { status: 500 }
      );
    }

    // Audit log the adjustment
    auditLog({
      userId: session.user.id,
      userName: session.user.name ?? null,
      userRole: session.user.role,
      action: "CREATE",
      objectType: "LedgerEntry",
      objectId: entry.id,
      description: `Ledger adjustment for ${tenant.user?.name || tenantId}: ${description} ($${amount.toFixed(2)})`,
      newValue: {
        tenantId,
        amount,
        periodKey: resolvedPeriod,
        description,
        balanceAfter: Number(entry.balanceAfter),
      },
      req,
    });

    return NextResponse.json({
      success: true,
      entry: {
        id: entry.id,
        type: entry.type,
        amount: Number(entry.amount),
        balanceAfter: Number(entry.balanceAfter),
        periodKey: entry.periodKey,
        description: entry.description,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

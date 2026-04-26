export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { resolveApiLandlord } from "@/lib/api-landlord";
import { paymentLimiter, rateLimitResponse } from "@/lib/rate-limit";
import {
  recordOfflinePayment,
  OfflinePaymentError,
} from "@/lib/offline-payments/record";

/**
 * Offline payments — cash + check receipts that bypass Kadima.
 *
 * POST /api/payments/offline
 *   Records a new cash or check receipt. Reserves a receipt number,
 *   credits the tenant ledger, returns `{ paymentId, receiptNumber }`.
 *   Auth: PM or admin "View as PM" via resolveApiLandlord(). Rate-
 *   limited via the shared paymentLimiter (20 req / 60s / user).
 *
 * GET /api/payments/offline
 *   Lists offline payments scoped to the resolved landlord. Drives
 *   the Cash Drawer in Phase 2; the GET shape lands now so Phase 2
 *   only needs to add the table component.
 *
 *   Filters (all optional):
 *     ?from=YYYY-MM-DD       — dateReceived gte
 *     ?to=YYYY-MM-DD         — dateReceived lte
 *     ?method=cash|check     — paymentMethod filter
 *     ?voided=false|true|all — default false (hide voided)
 */

const postSchema = z.object({
  tenantId: z.string().min(1),
  amount: z.coerce.number().positive(),
  method: z.enum(["cash", "check"]),
  dateReceived: z.string().min(1), // ISO
  notes: z.string().optional(),
  checkNumber: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const ctx = await resolveApiLandlord();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit by the actor (admin if impersonating, PM otherwise) —
  // matches the existing /api/payments pattern.
  const rl = await paymentLimiter.limit(ctx.actorId);
  if (!rl.success) return rateLimitResponse(rl.reset);

  try {
    const body = await req.json();
    const data = postSchema.parse(body);

    const dateReceived = new Date(data.dateReceived);
    if (Number.isNaN(dateReceived.getTime())) {
      return NextResponse.json(
        { error: "Invalid dateReceived" },
        { status: 400 }
      );
    }

    const result = await recordOfflinePayment({
      tenantId: data.tenantId,
      amount: data.amount,
      method: data.method,
      dateReceived,
      notes: data.notes,
      checkNumber: data.checkNumber,
      actorId: ctx.actorId,
      landlordId: ctx.landlordId,
    });

    return NextResponse.json(
      {
        success: true,
        paymentId: result.paymentId,
        receiptNumber: result.receiptNumber,
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0].message },
        { status: 400 }
      );
    }
    if (err instanceof OfflinePaymentError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status }
      );
    }
    console.error("[payments/offline] POST error:", err);
    return NextResponse.json(
      { error: "Failed to record offline payment" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const ctx = await resolveApiLandlord();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const from = sp.get("from");
  const to = sp.get("to");
  const method = sp.get("method");
  const voided = sp.get("voided") || "false";

  const where: Record<string, unknown> = {
    landlordId: ctx.landlordId,
    source: "offline",
  };
  if (method === "cash" || method === "check") {
    where.paymentMethod = method;
  }
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      range.lte = end;
    }
    where.dateReceived = range;
  }
  if (voided === "false") where.voidedAt = null;
  else if (voided === "true") where.voidedAt = { not: null };
  // voided=all → no filter

  const payments = await db.payment.findMany({
    where,
    include: {
      tenant: {
        select: {
          id: true,
          user: { select: { name: true, email: true } },
        },
      },
      unit: {
        select: {
          unitNumber: true,
          property: { select: { id: true, name: true } },
        },
      },
      collectedBy: { select: { id: true, name: true } },
    },
    orderBy: [{ dateReceived: "desc" }, { createdAt: "desc" }],
    take: 500,
  });

  return NextResponse.json({
    payments: payments.map((p) => ({
      id: p.id,
      receiptNumber: p.receiptNumber,
      amount: Number(p.amount),
      method: p.paymentMethod,
      dateReceived: p.dateReceived?.toISOString() ?? null,
      notes: p.notes,
      tenantName: p.tenant.user?.name ?? null,
      tenantEmail: p.tenant.user?.email ?? null,
      unitNumber: p.unit.unitNumber,
      propertyId: p.unit.property.id,
      propertyName: p.unit.property.name,
      collectedByName: p.collectedBy?.name ?? null,
      voidedAt: p.voidedAt?.toISOString() ?? null,
      voidReason: p.voidReason,
      createdAt: p.createdAt.toISOString(),
    })),
    count: payments.length,
  });
}

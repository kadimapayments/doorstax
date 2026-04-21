export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveApiLandlord } from "@/lib/api-landlord";
import { db } from "@/lib/db";
import {
  createRecoveryPlan,
  RecoveryValidationError,
} from "@/lib/recovery/service";
import { z } from "zod";

/**
 * GET /api/recovery-plans
 *   List the PM's recovery plans (or admin-impersonated PM's plans via
 *   resolveApiLandlord). Optional ?status=PLAN_ACTIVE filter. Scoped by
 *   landlordId — no cross-PM leakage.
 *
 * POST /api/recovery-plans
 *   Create a new plan. Plan starts as PLAN_OFFERED unless
 *   `activateImmediately=true` is passed.
 */

const createSchema = z.object({
  tenantId: z.string().min(1),
  originalBalance: z.coerce.number().min(0),
  forgivenessAmount: z.coerce.number().min(0),
  requiredPayments: z.coerce.number().int().min(1).max(12),
  startDate: z.string().min(1), // ISO
  graceDays: z.coerce.number().int().min(0).max(30).optional(),
  failurePolicy: z.enum(["FAIL", "RESET"]).optional(),
  notes: z.string().optional(),
  activateImmediately: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const ctx = await resolveApiLandlord();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status") || undefined;

  const plans = await db.recoveryPlan.findMany({
    where: {
      landlordId: ctx.landlordId,
      ...(status ? { status: status as never } : {}),
    },
    include: {
      tenant: {
        select: {
          id: true,
          user: { select: { name: true, email: true } },
        },
      },
      unit: { select: { id: true, unitNumber: true } },
      property: { select: { id: true, name: true } },
      _count: { select: { paymentLogs: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ plans });
}

export async function POST(req: NextRequest) {
  const ctx = await resolveApiLandlord();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    const plan = await createRecoveryPlan({
      tenantId: data.tenantId,
      landlordId: ctx.landlordId,
      originalBalance: data.originalBalance,
      forgivenessAmount: data.forgivenessAmount,
      requiredPayments: data.requiredPayments,
      startDate: new Date(data.startDate),
      graceDays: data.graceDays,
      failurePolicy: data.failurePolicy,
      notes: data.notes,
      createdById: ctx.actorId,
      activateImmediately: data.activateImmediately,
    });

    return NextResponse.json({ plan }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0].message, field: err.errors[0].path.join(".") },
        { status: 400 }
      );
    }
    if (err instanceof RecoveryValidationError) {
      return NextResponse.json(
        { error: err.message, field: err.field },
        { status: 400 }
      );
    }
    console.error("POST /api/recovery-plans error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

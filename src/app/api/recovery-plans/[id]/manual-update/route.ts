export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveApiLandlord } from "@/lib/api-landlord";
import {
  manualUpdatePlan,
  RecoveryValidationError,
} from "@/lib/recovery/service";
import { RecoveryTransitionError } from "@/lib/recovery/status";
import { z } from "zod";

/**
 * POST /api/recovery-plans/[id]/manual-update
 *
 * Privileged override for PMs / admins. All changes are audit-logged
 * with the actor + a required explanatory note, so operators reading
 * the audit log can always see WHY a plan was nudged.
 *
 * Body:
 *   {
 *     note: string,                       // required — appears in audit log
 *     overrides: {
 *       status?: RecoveryPlanStatus,      // must pass assertTransition
 *       completedPayments?: number,       // 0..requiredPayments
 *       forgivenessAmount?: number,       // 0..originalBalance (before apply)
 *       notes?: string,                   // free-form PM-facing note
 *     }
 *   }
 */

const schema = z.object({
  note: z.string().min(1, "Explanatory note is required"),
  overrides: z
    .object({
      status: z
        .enum([
          "PLAN_OFFERED",
          "PLAN_ACTIVE",
          "PLAN_AT_RISK",
          "PLAN_FAILED",
          "PLAN_COMPLETED",
          "PLAN_CANCELLED",
        ])
        .optional(),
      completedPayments: z.coerce.number().int().min(0).optional(),
      forgivenessAmount: z.coerce.number().min(0).optional(),
      notes: z.string().optional(),
    })
    .default({}),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await resolveApiLandlord();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const body = await req.json();
    const data = schema.parse(body);

    const { db } = await import("@/lib/db");
    const plan = await db.recoveryPlan.findUnique({
      where: { id },
      select: { landlordId: true },
    });
    if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (plan.landlordId !== ctx.landlordId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = await manualUpdatePlan(id, {
      actorId: ctx.actorId,
      note: data.note,
      overrides: data.overrides,
    });

    return NextResponse.json({ plan: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    if (err instanceof RecoveryTransitionError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof RecoveryValidationError) {
      return NextResponse.json(
        { error: err.message, field: err.field },
        { status: 400 }
      );
    }
    console.error("POST /api/recovery-plans/[id]/manual-update error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

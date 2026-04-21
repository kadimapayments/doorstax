export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveApiLandlord } from "@/lib/api-landlord";
import {
  activatePlan,
  cancelPlan,
  getPlanById,
  RecoveryValidationError,
} from "@/lib/recovery/service";
import { RecoveryTransitionError } from "@/lib/recovery/status";
import { z } from "zod";

/**
 * GET  /api/recovery-plans/[id]      — full plan + logs + audit trail
 * POST /api/recovery-plans/[id]      — lifecycle actions:
 *                                      { action: "activate" }
 *                                      { action: "cancel", reason: string }
 *
 * Mutations beyond these (manual overrides) go through the dedicated
 * manual-update endpoint.
 */

const actionSchema = z.object({
  action: z.enum(["activate", "cancel"]),
  reason: z.string().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await resolveApiLandlord();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const plan = await getPlanById(id);
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (plan.landlordId !== ctx.landlordId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ plan });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await resolveApiLandlord();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await getPlanById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.landlordId !== ctx.landlordId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = actionSchema.parse(body);

    if (parsed.action === "activate") {
      const plan = await activatePlan(id, ctx.actorId);
      return NextResponse.json({ plan });
    }
    if (parsed.action === "cancel") {
      if (!parsed.reason || !parsed.reason.trim()) {
        return NextResponse.json(
          { error: "Cancellation reason required" },
          { status: 400 }
        );
      }
      const plan = await cancelPlan(id, ctx.actorId, parsed.reason.trim());
      return NextResponse.json({ plan });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    if (err instanceof RecoveryTransitionError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof RecoveryValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("POST /api/recovery-plans/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

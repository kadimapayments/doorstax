export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveApiLandlord } from "@/lib/api-landlord";
import { db } from "@/lib/db";
import { z } from "zod";

/**
 * Tenant notes — PM-authored free-form notes on a tenant profile. Two
 * flavors exist (see `source`):
 *   GENERAL  — authored from the tenant detail page
 *   RECOVERY — authored from a recovery plan detail page
 *
 * Both flavors show on the tenant profile; only RECOVERY notes (matched
 * by recoveryPlanId) show on the recovery plan page. The distinction
 * exists so a PM can see "all activity about this tenant" on their
 * profile without RECOVERY notes drowning out plan-specific context.
 *
 * GET  /api/tenant-notes?tenantId=...  (or ?recoveryPlanId=...)
 * POST /api/tenant-notes
 */

const createSchema = z.object({
  tenantId: z.string().min(1),
  content: z.string().min(1, "Note cannot be empty"),
  source: z.enum(["GENERAL", "RECOVERY"]).optional(),
  recoveryPlanId: z.string().optional(),
  isPinned: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const ctx = await resolveApiLandlord();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = req.nextUrl.searchParams.get("tenantId");
  const recoveryPlanId = req.nextUrl.searchParams.get("recoveryPlanId");

  if (!tenantId && !recoveryPlanId) {
    return NextResponse.json(
      { error: "tenantId or recoveryPlanId is required" },
      { status: 400 }
    );
  }

  const where: Record<string, unknown> = {
    landlordId: ctx.landlordId,
  };
  if (tenantId) where.tenantId = tenantId;
  if (recoveryPlanId) where.recoveryPlanId = recoveryPlanId;

  const notes = await db.tenantNote.findMany({
    where,
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  // Resolve author names in one batch for display
  const authorIds = [...new Set(notes.map((n) => n.authorId))];
  const authors = authorIds.length
    ? await db.user.findMany({
        where: { id: { in: authorIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const authorMap = new Map(authors.map((a) => [a.id, a]));

  return NextResponse.json({
    notes: notes.map((n) => ({
      ...n,
      author: authorMap.get(n.authorId) || null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const ctx = await resolveApiLandlord();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    // Verify the tenant belongs to this PM (via unit → property → landlordId)
    const tenant = await db.tenantProfile.findFirst({
      where: {
        id: data.tenantId,
        unit: { property: { landlordId: ctx.landlordId } },
      },
      select: { id: true },
    });
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // If recoveryPlanId supplied, verify it also belongs to this PM + tenant
    if (data.recoveryPlanId) {
      const plan = await db.recoveryPlan.findFirst({
        where: {
          id: data.recoveryPlanId,
          tenantId: data.tenantId,
          landlordId: ctx.landlordId,
        },
        select: { id: true },
      });
      if (!plan) {
        return NextResponse.json(
          { error: "Recovery plan not found for this tenant" },
          { status: 404 }
        );
      }
    }

    const note = await db.tenantNote.create({
      data: {
        tenantId: data.tenantId,
        landlordId: ctx.landlordId,
        authorId: ctx.actorId,
        source: data.source || (data.recoveryPlanId ? "RECOVERY" : "GENERAL"),
        recoveryPlanId: data.recoveryPlanId || null,
        content: data.content.trim(),
        isPinned: data.isPinned || false,
      },
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    console.error("POST /api/tenant-notes error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

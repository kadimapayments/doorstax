export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveApiLandlord } from "@/lib/api-landlord";
import { db } from "@/lib/db";
import { z } from "zod";

/**
 * PATCH /api/tenant-notes/[id]  — edit content or pin flag
 * DELETE /api/tenant-notes/[id] — remove a note
 *
 * Only the PM that owns the tenant (or an admin impersonating them via
 * resolveApiLandlord) can mutate. Authors aren't required to match —
 * any PM team member with access can edit/delete, since notes are a
 * shared workspace artifact, not personal correspondence.
 */

const patchSchema = z
  .object({
    content: z.string().min(1).optional(),
    isPinned: z.boolean().optional(),
  })
  .refine(
    (v) => v.content !== undefined || v.isPinned !== undefined,
    { message: "Nothing to update" }
  );

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await resolveApiLandlord();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await db.tenantNote.findFirst({
    where: { id, landlordId: ctx.landlordId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await req.json();
    const data = patchSchema.parse(body);
    const note = await db.tenantNote.update({
      where: { id },
      data: {
        ...(data.content !== undefined ? { content: data.content.trim() } : {}),
        ...(data.isPinned !== undefined ? { isPinned: data.isPinned } : {}),
      },
    });
    return NextResponse.json({ note });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await resolveApiLandlord();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await db.tenantNote.findFirst({
    where: { id, landlordId: ctx.landlordId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.tenantNote.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

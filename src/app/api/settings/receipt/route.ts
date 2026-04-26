export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { resolveApiLandlord } from "@/lib/api-landlord";
import {
  validateReceiptPrefix,
  setReceiptStartSequence,
} from "@/lib/offline-payments/receipt-number";

/**
 * Receipt-numbering settings for offline payments.
 *
 * GET  → returns the landlord's current `receiptPrefix` and
 *        `nextReceiptSequence`.
 * PUT  → updates the prefix (validated) and optionally the starting
 *        sequence (only allowed to move forward — see
 *        setReceiptStartSequence).
 *
 * Auth via resolveApiLandlord — supports admin "View as PM" too.
 */

const putSchema = z.object({
  receiptPrefix: z.string().optional(),
  startSequence: z.coerce.number().int().min(1).optional(),
});

export async function GET() {
  const ctx = await resolveApiLandlord();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: ctx.landlordId },
    select: { receiptPrefix: true, nextReceiptSequence: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    receiptPrefix: user.receiptPrefix,
    nextReceiptSequence: user.nextReceiptSequence,
  });
}

export async function PUT(req: NextRequest) {
  const ctx = await resolveApiLandlord();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const data = putSchema.parse(body);

    // Prefix update.
    if (data.receiptPrefix !== undefined) {
      const validation = validateReceiptPrefix(data.receiptPrefix);
      if (!validation.ok) {
        return NextResponse.json(
          { error: validation.reason, field: "receiptPrefix" },
          { status: 400 }
        );
      }
      await db.user.update({
        where: { id: ctx.landlordId },
        data: { receiptPrefix: validation.value },
      });
    }

    // Sequence reset (forward-only).
    if (data.startSequence !== undefined) {
      const result = await setReceiptStartSequence(
        ctx.landlordId,
        data.startSequence
      );
      if (!result.ok) {
        return NextResponse.json(
          { error: result.reason, field: "startSequence" },
          { status: 400 }
        );
      }
    }

    const fresh = await db.user.findUnique({
      where: { id: ctx.landlordId },
      select: { receiptPrefix: true, nextReceiptSequence: true },
    });

    return NextResponse.json({
      success: true,
      receiptPrefix: fresh?.receiptPrefix,
      nextReceiptSequence: fresh?.nextReceiptSequence,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    console.error("[settings/receipt] PUT error:", err);
    return NextResponse.json(
      { error: "Failed to update receipt settings" },
      { status: 500 }
    );
  }
}

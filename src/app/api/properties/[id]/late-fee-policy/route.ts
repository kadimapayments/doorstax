export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";

/**
 * GET  /api/properties/[id]/late-fee-policy — fetch current policy (null if none)
 * PUT  /api/properties/[id]/late-fee-policy — upsert
 *
 * Gated to the property's landlord (or anyone on their team). The cron job
 * reads this policy to decide whether to accrue late fees.
 */

async function assertOwnership(propertyId: string, userId: string) {
  const landlordId = await getEffectiveLandlordId(userId);
  const prop = await db.property.findFirst({
    where: { id: propertyId, landlordId },
    select: { id: true },
  });
  return !!prop;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !["PM", "LANDLORD"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!(await assertOwnership(id, session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const policy = await db.lateFeePolicy.findUnique({
    where: { propertyId: id },
  });
  return NextResponse.json({ policy });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !["PM", "LANDLORD"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!(await assertOwnership(id, session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    enabled?: boolean;
    graceDays?: number | string;
    dailyAmount?: number | string;
    maxAmount?: number | string;
    notifyTenant?: boolean;
  };

  const graceDays = Math.max(0, Math.floor(Number(body.graceDays ?? 5)));
  const dailyAmount = Number(body.dailyAmount ?? 10);
  const maxAmount = Number(body.maxAmount ?? 100);

  if (!Number.isFinite(dailyAmount) || dailyAmount < 0) {
    return NextResponse.json({ error: "Invalid daily amount" }, { status: 400 });
  }
  if (!Number.isFinite(maxAmount) || maxAmount < 0) {
    return NextResponse.json({ error: "Invalid max amount" }, { status: 400 });
  }
  if (maxAmount > 0 && dailyAmount > maxAmount) {
    return NextResponse.json(
      { error: "Daily amount cannot exceed the maximum cap" },
      { status: 400 }
    );
  }

  const policy = await db.lateFeePolicy.upsert({
    where: { propertyId: id },
    create: {
      propertyId: id,
      enabled: body.enabled ?? true,
      graceDays,
      dailyAmount,
      maxAmount,
      notifyTenant: body.notifyTenant ?? true,
    },
    update: {
      enabled: body.enabled ?? true,
      graceDays,
      dailyAmount,
      maxAmount,
      notifyTenant: body.notifyTenant ?? true,
    },
  });

  return NextResponse.json({ policy });
}

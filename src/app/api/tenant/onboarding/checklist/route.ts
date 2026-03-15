import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/tenant/onboarding/checklist
 * Returns the move-in checklist for the current tenant.
 * Auto-creates from the landlord's default template if none exists.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await db.tenantProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, unitId: true, unit: { select: { property: { select: { landlordId: true } } } } },
  });

  if (!profile?.unitId) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const landlordId = profile.unit?.property?.landlordId;
  if (!landlordId) {
    return NextResponse.json({ error: "Landlord not found" }, { status: 404 });
  }

  // Check for existing checklist
  let checklist = await db.moveInChecklist.findUnique({
    where: {
      tenantProfileId_unitId: {
        tenantProfileId: profile.id,
        unitId: profile.unitId,
      },
    },
  });

  // Auto-create from default template if none exists
  if (!checklist) {
    const defaultTemplate = await db.moveInTemplate.findFirst({
      where: { landlordId, isDefault: true },
    });

    if (defaultTemplate) {
      const templateItems = defaultTemplate.items as Array<{
        area: string;
        item: string;
        condition: string;
        notes?: string;
      }>;

      const itemsWithAck = templateItems.map((i) => ({
        ...i,
        acknowledged: false,
      }));

      checklist = await db.moveInChecklist.create({
        data: {
          tenantProfileId: profile.id,
          unitId: profile.unitId,
          landlordId,
          items: itemsWithAck,
        },
      });
    }
  }

  return NextResponse.json({
    checklist: checklist
      ? {
          id: checklist.id,
          items: checklist.items,
          acknowledgedAt: checklist.acknowledgedAt?.toISOString() || null,
        }
      : null,
    hasTemplate: !!checklist,
  });
}

/**
 * PUT /api/tenant/onboarding/checklist
 * Save acknowledged items. Sets acknowledgedAt when all items are acknowledged.
 */
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await db.tenantProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, unitId: true },
  });

  if (!profile?.unitId) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const checklist = await db.moveInChecklist.findUnique({
    where: {
      tenantProfileId_unitId: {
        tenantProfileId: profile.id,
        unitId: profile.unitId,
      },
    },
  });

  if (!checklist) {
    return NextResponse.json({ error: "Checklist not found" }, { status: 404 });
  }

  const { items } = await req.json();

  // Check if all items are acknowledged
  const allAcknowledged = (items as Array<{ acknowledged: boolean }>).every(
    (i) => i.acknowledged
  );

  const updated = await db.moveInChecklist.update({
    where: { id: checklist.id },
    data: {
      items,
      acknowledgedAt: allAcknowledged ? new Date() : null,
    },
  });

  return NextResponse.json({
    id: updated.id,
    items: updated.items,
    acknowledgedAt: updated.acknowledgedAt?.toISOString() || null,
  });
}

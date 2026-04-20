import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveApiLandlord } from "@/lib/api-landlord";
import { createPropertySchema } from "@/lib/validations/property";
import { syncSubscriptionAmount } from "@/lib/subscription";
import { completeOnboardingMilestone } from "@/lib/onboarding";
import { z } from "zod";

export async function GET() {
  const ctx = await resolveApiLandlord();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const properties = await db.property.findMany({
    where: { landlordId: ctx.landlordId },
    include: {
      units: {
        select: {
          id: true,
          unitNumber: true,
          rentAmount: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(properties);
}

export async function POST(req: Request) {
  const ctx = await resolveApiLandlord();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = createPropertySchema.parse(body);

    // New properties go straight into PENDING_REVIEW. Underwriters gate
    // this to APPROVED via /admin/property-reviews; only at that point do
    // terminal-provisioning and tier-crossing notices fire (see
    // /api/admin/property-reviews/[id] POST approve action). The schema-
    // level default is "APPROVED" so existing / legacy rows are untouched.
    const property = await db.property.create({
      data: {
        ...data,
        landlordId: ctx.landlordId,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
        boardingStatus: "PENDING_REVIEW",
        submittedForReviewAt: new Date(),
      },
    });

    // Sync subscription billing after property creation (PM-side, unrelated
    // to underwriter approval — unit count still maps to the tier).
    await syncSubscriptionAmount(ctx.landlordId).catch(() => {});

    // Guided Launch Mode: mark property milestone (PM onboarding UX)
    completeOnboardingMilestone(ctx.landlordId, "propertyAdded").catch(
      console.error
    );

    // Notify every admin with oversight permissions that a new property
    // needs their review. The terminal-request / tier-crossing notices
    // that used to fire here are deferred to the admin-approval step —
    // underwriters shouldn't be chasing terminal assignments for a
    // property they haven't cleared yet.
    try {
      const { notify } = await import("@/lib/notifications");
      const admins = await db.user.findMany({
        where: { role: "ADMIN" },
        select: { id: true },
      });
      await Promise.all(
        admins.map((a) =>
          notify({
            userId: a.id,
            createdById: ctx.actorId,
            type: "PROPERTY_REVIEW",
            title: "New property needs review",
            message: `"${property.name}" (${property.city}, ${property.state}) was submitted for underwriter review. Open the queue to approve, reject, or request more info.`,
            severity: "info",
            actionUrl: `/admin/property-reviews/${property.id}`,
          }).catch((e) =>
            console.error("[properties] admin review notify failed:", e)
          )
        )
      );
    } catch (e) {
      console.error("[properties] admin review notify failed:", e);
    }

    return NextResponse.json(property, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

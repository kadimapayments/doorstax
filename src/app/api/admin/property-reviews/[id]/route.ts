export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAdminContext, canAdmin } from "@/lib/admin-context";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/audit";

/**
 * GET /api/admin/property-reviews/[id]
 *   Full underwriter view of a single property — everything the admin
 *   needs to decide on approve / reject / request-info without bouncing
 *   pages. Includes units, documents, owner, PM contact, merchant app
 *   status.
 *
 * POST /api/admin/property-reviews/[id]
 *   Body: { action: "approve" | "reject" | "request-info", notes?: string }
 *   - approve      → boardingStatus=APPROVED, reviewedAt=now,
 *                    reviewedById=admin. Also fires the terminal-request
 *                    + tier-crossing notices that Batch A deferred —
 *                    they should happen only after underwriter clearance.
 *   - reject       → boardingStatus=REJECTED, notes saved to reviewNotes.
 *                    PM is notified with the reason.
 *   - request-info → boardingStatus=NEEDS_INFO, notes required. PM is
 *                    notified and can edit + add documents before the
 *                    admin approves on a follow-up review.
 *
 *   All three write an AuditLog entry.
 *
 * Gated by admin:landlords.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const adminCtx = await getAdminContext(session.user.id);
  if (!canAdmin(adminCtx, "admin:landlords")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const property = await db.property.findUnique({
    where: { id },
    include: {
      landlord: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          companyName: true,
          currentTier: true,
        },
      },
      owner: true,
      units: {
        select: {
          id: true,
          unitNumber: true,
          bedrooms: true,
          bathrooms: true,
          sqft: true,
          rentAmount: true,
          status: true,
        },
        orderBy: { unitNumber: "asc" },
      },
      documents: { orderBy: { uploadedAt: "desc" } },
    },
  });

  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const merchantApp = await db.merchantApplication.findUnique({
    where: { userId: property.landlordId },
    select: { status: true, kadimaAppId: true },
  });

  return NextResponse.json({ property, merchantApp });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const adminCtx = await getAdminContext(session.user.id);
  if (!canAdmin(adminCtx, "admin:landlords")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  const notes = (body.notes as string | undefined)?.trim() || null;

  const property = await db.property.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      landlordId: true,
      boardingStatus: true,
    },
  });
  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  if (action === "approve") {
    if (property.boardingStatus === "APPROVED") {
      return NextResponse.json(
        { error: "Property is already approved" },
        { status: 409 }
      );
    }

    await db.property.update({
      where: { id },
      data: {
        boardingStatus: "APPROVED",
        reviewedAt: new Date(),
        reviewedById: session.user.id,
        reviewNotes: notes,
      },
    });

    // Fire the notifications that were deferred in Batch A. These exist
    // on the PM side as "your property is live, here's what's next"
    // signals — terminal provisioning and tier crossing both only make
    // sense once the property has been cleared.
    try {
      const { notify } = await import("@/lib/notifications");
      await notify({
        userId: property.landlordId,
        createdById: session.user.id,
        type: "PROPERTY_APPROVED",
        title: "Property approved",
        message: `"${property.name}" is now approved. Live card / ACH payments and terminal assignment are unlocked.`,
        severity: "info",
        actionUrl: `/dashboard/properties/${property.id}`,
      }).catch(console.error);

      // Terminal-request notice for the admin ops queue (the existing
      // /admin/terminal-requests flow). Only fires if PM has a live
      // merchant app — otherwise there's nothing to provision against.
      const merchantApp = await db.merchantApplication.findUnique({
        where: { userId: property.landlordId },
        select: { status: true },
      });
      if (
        merchantApp &&
        (merchantApp.status === "APPROVED" ||
          merchantApp.status === "SUBMITTED")
      ) {
        await notify({
          userId: property.landlordId,
          createdById: session.user.id,
          type: "TERMINAL_REQUEST",
          title: "Terminal assignment pending",
          message: `Property "${property.name}" is approved and needs a Kadima terminal assignment.`,
          severity: "warning",
          actionUrl: `/dashboard/properties/${property.id}`,
        }).catch(console.error);
      }

      // Tier crossing: the PM may have crossed into a higher tier
      // now that this property's units count toward their total.
      const { checkTierCrossing } = await import("@/lib/residual-tiers");
      const crossing = await checkTierCrossing(property.landlordId);
      if (crossing) {
        const { notifyTierCrossing } = await import(
          "@/lib/tier-notifications"
        );
        notifyTierCrossing(property.landlordId, crossing).catch((e) =>
          console.error("[property-reviews] tier notify failed:", e)
        );
      }
    } catch (e) {
      console.error("[property-reviews] post-approve notifications failed:", e);
    }

    auditLog({
      userId: session.user.id,
      userRole: "ADMIN",
      action: "APPROVE",
      objectType: "Property",
      objectId: property.id,
      description: `Approved property ${property.name} (PM ${property.landlordId})${
        notes ? ` — ${notes}` : ""
      }`,
      req,
    });

    return NextResponse.json({ ok: true, boardingStatus: "APPROVED" });
  }

  if (action === "reject") {
    if (!notes) {
      return NextResponse.json(
        { error: "A reason (notes) is required for rejection" },
        { status: 400 }
      );
    }

    await db.property.update({
      where: { id },
      data: {
        boardingStatus: "REJECTED",
        reviewedAt: new Date(),
        reviewedById: session.user.id,
        reviewNotes: notes,
      },
    });

    try {
      const { notify } = await import("@/lib/notifications");
      await notify({
        userId: property.landlordId,
        createdById: session.user.id,
        type: "PROPERTY_REJECTED",
        title: "Property rejected by underwriter",
        message: `"${property.name}" was not approved. Reason: ${notes}. Contact DoorStax support to discuss next steps.`,
        severity: "urgent",
        actionUrl: `/dashboard/properties/${property.id}`,
      }).catch(console.error);
    } catch {}

    auditLog({
      userId: session.user.id,
      userRole: "ADMIN",
      action: "REJECT",
      objectType: "Property",
      objectId: property.id,
      description: `Rejected property ${property.name} (PM ${property.landlordId}) — ${notes}`,
      req,
    });

    return NextResponse.json({ ok: true, boardingStatus: "REJECTED" });
  }

  if (action === "request-info") {
    if (!notes) {
      return NextResponse.json(
        { error: "Notes are required when requesting more info" },
        { status: 400 }
      );
    }

    await db.property.update({
      where: { id },
      data: {
        boardingStatus: "NEEDS_INFO",
        reviewedAt: new Date(),
        reviewedById: session.user.id,
        reviewNotes: notes,
      },
    });

    try {
      const { notify } = await import("@/lib/notifications");
      await notify({
        userId: property.landlordId,
        createdById: session.user.id,
        type: "PROPERTY_NEEDS_INFO",
        title: "Underwriter needs more info",
        message: `DoorStax underwriting needs more information on "${property.name}" before approving. ${notes}`,
        severity: "warning",
        actionUrl: `/dashboard/properties/${property.id}`,
      }).catch(console.error);
    } catch {}

    auditLog({
      userId: session.user.id,
      userRole: "ADMIN",
      action: "REQUEST_INFO",
      objectType: "Property",
      objectId: property.id,
      description: `Requested more info on ${property.name} (PM ${property.landlordId}) — ${notes}`,
      req,
    });

    return NextResponse.json({ ok: true, boardingStatus: "NEEDS_INFO" });
  }

  return NextResponse.json(
    { error: `Unknown action: ${action}` },
    { status: 400 }
  );
}

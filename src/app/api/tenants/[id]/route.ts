import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { auditLog } from "@/lib/audit";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !["PM", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const tenant = await db.tenantProfile.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      unit: {
        select: {
          id: true,
          unitNumber: true,
          rentAmount: true,
          property: { select: { name: true } },
        },
      },
    },
  });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  // Verify landlord owns this tenant's unit (admins bypass)
  if (session.user.role === "PM" && tenant.unit) {
    const unit = await db.unit.findFirst({
      where: { id: tenant.unit.id, property: { landlordId: session.user.id } },
    });
    if (!unit) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
  }

  return NextResponse.json({
    id: tenant.id,
    name: tenant.user.name,
    email: tenant.user.email,
    phone: tenant.user.phone,
    status: tenant.status,
    unitId: tenant.unitId,
    unitNumber: tenant.unit?.unitNumber || "—",
    propertyName: tenant.unit?.property.name || "—",
    rentAmount: Number(tenant.unit?.rentAmount || 0),
    splitPercent: tenant.splitPercent,
    isPrimary: tenant.isPrimary,
    leaseStart: tenant.leaseStart,
    leaseEnd: tenant.leaseEnd,
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !["PM", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Find the tenant profile (include user for audit old-value capture)
  const tenant = await db.tenantProfile.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      unit: {
        select: {
          id: true,
          property: { select: { landlordId: true } },
        },
      },
    },
  });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  // Verify landlord ownership via property chain (admins bypass)
  if (session.user.role === "PM" && tenant.unit) {
    if (tenant.unit.property.landlordId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
  }

  const body = await req.json();
  const { name, email, phone, status } = body;

  // Update user fields (name, email, phone)
  const userUpdate: Record<string, string> = {};
  if (name !== undefined) userUpdate.name = name;
  if (email !== undefined) userUpdate.email = email;
  if (phone !== undefined) userUpdate.phone = phone;

  if (Object.keys(userUpdate).length > 0) {
    await db.user.update({
      where: { id: tenant.userId },
      data: userUpdate,
    });
  }

  // Update tenant profile status if provided
  const validStatuses = ["PROSPECT", "ACTIVE", "PREVIOUS"];
  if (status && validStatuses.includes(status)) {
    await db.tenantProfile.update({
      where: { id },
      data: { status },
    });
  }

  // Fetch updated tenant to return
  const updated = await db.tenantProfile.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true, phone: true } },
    },
  });

  // Compute what actually changed for the audit log
  const changedFields: Record<string, unknown> = {};
  const previousFields: Record<string, unknown> = {};
  if (name !== undefined && name !== tenant.user.name) { previousFields.name = tenant.user.name; changedFields.name = name; }
  if (email !== undefined && email !== tenant.user.email) { previousFields.email = tenant.user.email; changedFields.email = email; }
  if (phone !== undefined && phone !== tenant.user.phone) { previousFields.phone = tenant.user.phone; changedFields.phone = phone; }
  if (status && status !== tenant.status) { previousFields.status = tenant.status; changedFields.status = status; }

  if (Object.keys(changedFields).length > 0) {
    auditLog({
      userId: session.user.id,
      userName: session.user.name,
      userRole: session.user.role,
      action: "UPDATE",
      objectType: "Tenant",
      objectId: id,
      description: `Updated tenant ${updated!.user.name}`,
      oldValue: previousFields,
      newValue: changedFields,
      req,
    });
  }

  return NextResponse.json({
    id: updated!.id,
    name: updated!.user.name,
    email: updated!.user.email,
    phone: updated!.user.phone,
    status: updated!.status,
  });
}

/* ── DELETE: soft-delete tenant with reason code ── */

const VALID_REASONS = [
  "LEASE_ENDED",
  "EVICTION",
  "NON_PAYMENT",
  "VOLUNTARY_DEPARTURE",
  "POLICY_VIOLATION",
  "OTHER",
];

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !["PM", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: { reason?: string; notes?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { reason, notes } = body;

  if (!reason || !VALID_REASONS.includes(reason)) {
    return NextResponse.json(
      { error: "A valid deletion reason is required" },
      { status: 400 }
    );
  }

  // Find the tenant profile with relations
  const tenant = await db.tenantProfile.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      unit: {
        select: {
          id: true,
          rentAmount: true,
          property: { select: { id: true, landlordId: true, name: true } },
        },
      },
      recurringBilling: true,
    },
  });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  if (tenant.status === "DELETED") {
    return NextResponse.json({ error: "Tenant already deleted" }, { status: 400 });
  }

  // Verify landlord ownership via property chain (admins bypass)
  if (session.user.role === "PM" && tenant.unit) {
    if (tenant.unit.property.landlordId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
  }

  const unitId = tenant.unitId;
  const now = new Date();

  try {
    await db.$transaction(async (tx) => {
      // 1. Soft-delete the tenant profile
      await tx.tenantProfile.update({
        where: { id },
        data: {
          status: "DELETED",
          deletedAt: now,
          deletionReason: reason,
          deletionNotes: notes || null,
          unitId: null,
          autopayEnabled: false,
          splitPercent: 0,
        },
      });

      // 2. Cancel active recurring billing
      if (tenant.recurringBilling && tenant.recurringBilling.status === "ACTIVE") {
        await tx.recurringBilling.update({
          where: { id: tenant.recurringBilling.id },
          data: { status: "CANCELLED", endDate: now },
        });
      }

      // 3. Delete unexecuted scheduled payments
      await tx.scheduledPayment.deleteMany({
        where: { tenantId: id, executed: false },
      });

      // 4. Terminate active leases
      await tx.lease.updateMany({
        where: { tenantId: id, status: "ACTIVE" },
        data: { status: "TERMINATED" },
      });

      // 5. Handle unit occupancy and rent splits
      if (unitId) {
        const existingSplit = await tx.rentSplit.findUnique({
          where: { unitId },
        });

        if (existingSplit) {
          await tx.rentSplitItem.deleteMany({
            where: { rentSplitId: existingSplit.id, tenantId: id },
          });
        }

        // Get remaining tenants in the unit
        const remaining = await tx.tenantProfile.findMany({
          where: { unitId },
        });

        if (remaining.length === 0) {
          // No tenants left — set unit to AVAILABLE and clean up
          await tx.unit.update({
            where: { id: unitId },
            data: { status: "AVAILABLE" },
          });
          if (existingSplit) {
            await tx.rentSplitItem.deleteMany({
              where: { rentSplitId: existingSplit.id },
            });
            await tx.rentSplit.delete({ where: { id: existingSplit.id } });
          }
        } else {
          // Redistribute splits evenly among remaining tenants
          const count = remaining.length;
          const evenSplit = Math.floor(100 / count);
          const remainder = 100 - evenSplit * count;

          for (const profile of remaining) {
            const pct = profile.isPrimary ? evenSplit + remainder : evenSplit;
            await tx.tenantProfile.update({
              where: { id: profile.id },
              data: { splitPercent: count === 1 ? 100 : pct },
            });
          }

          // Rebuild the RentSplit + RentSplitItems
          if (existingSplit) {
            await tx.rentSplitItem.deleteMany({
              where: { rentSplitId: existingSplit.id },
            });
            await tx.rentSplit.delete({ where: { id: existingSplit.id } });
          }

          const unit = await tx.unit.findUnique({ where: { id: unitId } });
          if (unit) {
            const totalRent = Number(unit.rentAmount);
            await tx.rentSplit.create({
              data: {
                unitId,
                totalRent: unit.rentAmount,
                splits: {
                  create: remaining.map((profile) => {
                    const pct =
                      count === 1
                        ? 100
                        : profile.isPrimary
                          ? evenSplit + remainder
                          : evenSplit;
                    return {
                      tenantId: profile.id,
                      percent: pct,
                      amount: (totalRent * pct) / 100,
                    };
                  }),
                },
              },
            });
          }
        }
      }
    });

    // Auto-generate RentSpree apply link when unit becomes available (non-blocking)
    if (unitId) {
      const remainingCount = await db.tenantProfile.count({ where: { unitId } });
      if (remainingCount === 0) {
        try {
          const { isRentSpreeConfigured } = await import("@/lib/rentspree/client");
          if (isRentSpreeConfigured()) {
            const { generateApplyLink } = await import("@/lib/rentspree/client");
            const { resolveScreeningConfig } = await import("@/lib/rentspree/screening-config");
            const config = await resolveScreeningConfig(unitId, session.user.id);
            const result = await generateApplyLink(config);
            await db.unit.update({
              where: { id: unitId },
              data: {
                applyLink: result.applyLink.shortenLink,
                applyLinkFull: result.applyLink.fullLink,
                rentspreeScreeningOptId: result.screeningOption._id,
                applyLinkGeneratedAt: new Date(),
              },
            });
            console.log("[rentspree] Auto-generated apply link for unit", unitId);
          }
        } catch (err) {
          console.error("[rentspree] Auto-generate failed (non-blocking):", err);
        }
      }
    }

    auditLog({
      userId: session.user.id,
      userName: session.user.name,
      userRole: session.user.role,
      action: "DELETE",
      objectType: "Tenant",
      objectId: id,
      description: `Removed tenant ${tenant.user.name} (${reason})`,
      newValue: { reason, notes: notes || null, tenantName: tenant.user.name, tenantEmail: tenant.user.email },
      req,
    });

    // 6. Notify tenant (outside transaction so it doesn't block)
    const reasonLabel = reason.replace(/_/g, " ").toLowerCase();
    await notify({
      userId: tenant.user.id,
      createdById: session.user.id,
      type: "CUSTOM",
      title: "Account Removed",
      message: `Your tenant profile has been removed by your property manager. Reason: ${reasonLabel}.`,
      severity: "urgent",
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[delete-tenant] Error:", error);
    return NextResponse.json(
      { error: "Failed to remove tenant" },
      { status: 500 }
    );
  }
}

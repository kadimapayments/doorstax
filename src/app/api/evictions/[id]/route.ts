import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { auditLog } from "@/lib/audit";
import { notify } from "@/lib/notifications";

const DATE_FIELDS = [
  "noticeServedAt", "noticeDeadline", "curedAt", "filedAt",
  "hearingDate", "judgmentDate", "writIssuedAt", "moveOutDeadline",
  "lockoutDate", "resolvedAt",
];

const ALLOWED_FIELDS = [
  "status", "noticeType", "noticeDays", "noticeMethod",
  ...DATE_FIELDS,
  "cureAmount", "caseNumber", "courtName", "filingFee",
  "hearingNotes", "judgmentResult",
  "resolutionType", "resolutionNotes",
  "outstandingBalance", "damagesAssessed", "depositDisposition",
  "reasonDetails",
];

/** GET: Full eviction detail */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !["PM", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const landlordId = await getEffectiveLandlordId(session.user.id);

  const eviction = await db.eviction.findFirst({
    where: { id, landlordId },
    include: {
      tenant: { include: { user: { select: { id: true, name: true, email: true, phone: true } } } },
      unit: { select: { unitNumber: true, rentAmount: true, property: { select: { id: true, name: true, address: true, city: true, state: true, zip: true } } } },
      documents: { orderBy: { createdAt: "desc" } },
      timeline: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!eviction) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...eviction,
    outstandingBalance: eviction.outstandingBalance ? Number(eviction.outstandingBalance) : null,
    damagesAssessed: eviction.damagesAssessed ? Number(eviction.damagesAssessed) : null,
    depositDisposition: eviction.depositDisposition ? Number(eviction.depositDisposition) : null,
    filingFee: eviction.filingFee ? Number(eviction.filingFee) : null,
    cureAmount: eviction.cureAmount ? Number(eviction.cureAmount) : null,
  });
}

/** PUT: Update eviction status / details */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !["PM", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const landlordId = await getEffectiveLandlordId(session.user.id);
  const body = await req.json();

  const eviction = await db.eviction.findFirst({
    where: { id, landlordId },
    include: {
      tenant: { include: { user: { select: { id: true, name: true, email: true } } } },
      unit: { select: { unitNumber: true, property: { select: { name: true } } } },
    },
  });

  if (!eviction) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Build update data
  const updateData: Record<string, unknown> = {};

  for (const field of ALLOWED_FIELDS) {
    if (body[field] !== undefined) {
      if (DATE_FIELDS.includes(field)) {
        updateData[field] = body[field] ? new Date(body[field]) : null;
      } else {
        updateData[field] = body[field];
      }
    }
  }

  // Timeline events
  const timelineEvents: Array<{ type: string; title: string; description?: string; createdBy: string }> = [];

  if (body.status && body.status !== eviction.status) {
    const statusLabels: Record<string, string> = {
      NOTICE_PENDING: "Notice pending",
      NOTICE_SERVED: "Notice served",
      CURE_PERIOD: "Cure period active",
      FILING_PENDING: "Ready to file",
      FILED: "Filed with court",
      HEARING_SCHEDULED: "Hearing scheduled",
      JUDGMENT: "Judgment entered",
      WRIT_ISSUED: "Writ of possession issued",
      COMPLETED: "Eviction completed",
      CANCELLED: "Eviction cancelled",
    };

    timelineEvents.push({
      type: "STATUS_CHANGE",
      title: `Status → ${statusLabels[body.status] || body.status}`,
      description: body.statusNote || undefined,
      createdBy: session.user.id,
    });

    // Handle completion — freeze tenant
    if (body.status === "COMPLETED") {
      updateData.resolvedAt = new Date();
      updateData.resolutionType = body.resolutionType || "EVICTED";

      await db.tenantProfile.update({
        where: { id: eviction.tenantId },
        data: {
          status: "DELETED",
          deletedAt: new Date(),
          deletionReason: "EVICTION",
          deletionNotes: `Eviction case ${id} completed. ${body.resolutionNotes || ""}`.trim(),
          autopayEnabled: false,
        },
      });

      await db.recurringBilling.updateMany({
        where: { tenantId: eviction.tenantId, status: "ACTIVE" },
        data: { status: "CANCELLED", endDate: new Date() },
      });

      await db.lease.updateMany({
        where: { tenantId: eviction.tenantId, status: "ACTIVE" },
        data: { status: "TERMINATED" },
      });

      if (eviction.unitId) {
        await db.unit.update({
          where: { id: eviction.unitId },
          data: { status: "AVAILABLE" },
        });
      }

      await db.scheduledPayment.deleteMany({
        where: { tenantId: eviction.tenantId, executed: false },
      });

      // Ledger entry for damages if assessed
      try {
        const { createChargeEntry, periodKeyFromDate } = await import("@/lib/ledger");
        if (eviction.damagesAssessed && Number(eviction.damagesAssessed) > 0) {
          await createChargeEntry({
            tenantId: eviction.tenantId,
            unitId: eviction.unitId,
            amount: Number(eviction.damagesAssessed),
            periodKey: periodKeyFromDate(new Date()),
            description: `Damages assessed — eviction case ${id}`,
          });
        }
      } catch (ledgerErr) {
        console.error("[eviction] Ledger entry failed:", ledgerErr);
      }
    }

    if (body.status === "CANCELLED") {
      updateData.resolvedAt = new Date();
      updateData.resolutionType = body.resolutionType || "DISMISSED";
    }

    // Notify tenant on key status changes
    if (eviction.tenant?.user) {
      const statusMessages: Record<string, { title: string; message: string; severity: "info" | "warning" | "urgent" }> = {
        NOTICE_SERVED: {
          title: "Eviction Notice Served",
          message: `An eviction notice has been served for your unit at ${eviction.unit.property.name} Unit ${eviction.unit.unitNumber}.`,
          severity: "urgent",
        },
        CURE_PERIOD: {
          title: "Cure Period Started",
          message: "You have a limited time to resolve the eviction case. Please contact your property manager or make payment immediately.",
          severity: "urgent",
        },
        FILED: {
          title: "Eviction Filed with Court",
          message: `An eviction has been formally filed with the court for your unit. Case number: ${body.caseNumber || "pending"}.`,
          severity: "urgent",
        },
        HEARING_SCHEDULED: {
          title: "Eviction Hearing Scheduled",
          message: `A court hearing for your eviction case has been scheduled${body.hearingDate ? " for " + new Date(body.hearingDate).toLocaleDateString() : ""}.`,
          severity: "urgent",
        },
        JUDGMENT: {
          title: "Eviction Judgment Entered",
          message: `A judgment has been entered in the eviction case: ${body.judgmentResult?.replace(/_/g, " ") || "pending"}.`,
          severity: "urgent",
        },
        WRIT_ISSUED: {
          title: "Writ of Possession Issued",
          message: "A writ of possession has been issued. You must vacate the premises by the specified date.",
          severity: "urgent",
        },
        COMPLETED: {
          title: "Eviction Finalized",
          message: "The eviction for your unit has been finalized. Your account has been frozen.",
          severity: "urgent",
        },
        CANCELLED: {
          title: "Eviction Case Cancelled",
          message: "The eviction case for your unit has been cancelled. Your account remains active.",
          severity: "info",
        },
      };

      const msg = statusMessages[body.status];
      if (msg) {
        notify({
          userId: eviction.tenant.user.id,
          createdById: session.user.id,
          type: "EVICTION_UPDATE",
          title: msg.title,
          message: msg.message,
          severity: msg.severity,
        }).catch(console.error);
      }
    }
  }

  if (body.note) {
    timelineEvents.push({
      type: "NOTE",
      title: "Note added",
      description: body.note,
      createdBy: session.user.id,
    });
  }

  const updated = await db.eviction.update({
    where: { id },
    data: {
      ...updateData,
      ...(timelineEvents.length > 0 ? { timeline: { create: timelineEvents } } : {}),
    },
  });

  auditLog({
    userId: session.user.id,
    userName: session.user.name,
    userRole: session.user.role,
    action: "UPDATE",
    objectType: "Eviction",
    objectId: id,
    description: `Updated eviction: ${Object.keys(updateData).join(", ")}`,
    newValue: updateData,
    req,
  });

  return NextResponse.json({
    ...updated,
    outstandingBalance: updated.outstandingBalance ? Number(updated.outstandingBalance) : null,
    damagesAssessed: updated.damagesAssessed ? Number(updated.damagesAssessed) : null,
    depositDisposition: updated.depositDisposition ? Number(updated.depositDisposition) : null,
    filingFee: updated.filingFee ? Number(updated.filingFee) : null,
    cureAmount: updated.cureAmount ? Number(updated.cureAmount) : null,
  });
}

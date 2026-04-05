import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { auditLog } from "@/lib/audit";
import { z } from "zod";

const createEvictionSchema = z.object({
  tenantId: z.string(),
  reason: z.string(),
  reasonDetails: z.string().optional(),
  noticeType: z.string().optional(),
  noticeDays: z.number().optional(),
  cureAmount: z.number().optional(),
});

/** GET: List evictions for this PM */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || !["PM", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const tenantId = searchParams.get("tenantId");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { landlordId };
  if (status && status !== "all") where.status = status;
  if (tenantId) where.tenantId = tenantId;

  const evictions = await db.eviction.findMany({
    where,
    include: {
      tenant: { include: { user: { select: { name: true, email: true } } } },
      unit: { select: { unitNumber: true, property: { select: { name: true } } } },
      documents: { orderBy: { createdAt: "desc" } },
      timeline: { orderBy: { createdAt: "desc" }, take: 5 },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(evictions.map((e) => ({
    ...e,
    outstandingBalance: e.outstandingBalance ? Number(e.outstandingBalance) : null,
    damagesAssessed: e.damagesAssessed ? Number(e.damagesAssessed) : null,
    depositDisposition: e.depositDisposition ? Number(e.depositDisposition) : null,
    filingFee: e.filingFee ? Number(e.filingFee) : null,
    cureAmount: e.cureAmount ? Number(e.cureAmount) : null,
  })));
}

/** POST: Create a new eviction case */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !["PM", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);

  try {
    const body = await req.json();
    const data = createEvictionSchema.parse(body);

    const tenant = await db.tenantProfile.findFirst({
      where: { id: data.tenantId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        unit: { select: { id: true, unitNumber: true, property: { select: { name: true, landlordId: true } } } },
      },
    });

    if (!tenant || !tenant.unit || tenant.unit.property.landlordId !== landlordId) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const existing = await db.eviction.findFirst({
      where: { tenantId: data.tenantId, status: { notIn: ["COMPLETED", "CANCELLED"] } },
    });

    if (existing) {
      return NextResponse.json({ error: "An active eviction case already exists for this tenant" }, { status: 409 });
    }

    const unpaidPayments = await db.payment.findMany({
      where: { tenantId: data.tenantId, status: { in: ["PENDING", "FAILED"] } },
      select: { amount: true },
    });
    const outstandingBalance = unpaidPayments.reduce((sum, p) => sum + Number(p.amount), 0);

    const noticeDeadline = data.noticeDays
      ? new Date(Date.now() + data.noticeDays * 24 * 60 * 60 * 1000)
      : null;

    const eviction = await db.eviction.create({
      data: {
        tenantId: data.tenantId,
        unitId: tenant.unit.id,
        landlordId,
        reason: data.reason,
        reasonDetails: data.reasonDetails,
        noticeType: data.noticeType,
        noticeDays: data.noticeDays,
        noticeDeadline,
        cureAmount: data.cureAmount || outstandingBalance || undefined,
        outstandingBalance: outstandingBalance || undefined,
        status: "NOTICE_PENDING",
        timeline: {
          create: {
            type: "STATUS_CHANGE",
            title: "Eviction case created",
            description: `Reason: ${data.reason.replace(/_/g, " ")}. ${data.reasonDetails || ""}`.trim(),
            createdBy: session.user.id,
          },
        },
      },
    });

    auditLog({
      userId: session.user.id,
      userName: session.user.name,
      userRole: session.user.role,
      action: "CREATE",
      objectType: "Eviction",
      objectId: eviction.id,
      description: `Started eviction for ${tenant.user.name} — ${data.reason}`,
      req,
    });

    return NextResponse.json(eviction, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error("[evictions] Create error:", error);
    return NextResponse.json({ error: "Failed to create eviction" }, { status: 500 });
  }
}

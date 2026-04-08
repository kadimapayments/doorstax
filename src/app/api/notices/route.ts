import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET - Fetch active notices for current user
export async function GET() {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const notices = await db.dashboardNotice.findMany({
    where: {
      targetUserId: session.user.id,
      dismissedAt: null,
      readAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: {
      createdBy: { select: { name: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(notices);
}

// POST - Create a new notice (admin->landlord or landlord->tenant)
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { targetUserId, type, title, message, amount, severity } = body;

  if (!targetUserId || !title || !message) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // Verify permission: admin can notify anyone, PMs can notify their tenants and owners
  const user = session.user;
  if (user.role === "PM") {
    // Check if target is a tenant in one of the PM's properties
    const tenant = await db.tenantProfile.findFirst({
      where: {
        userId: targetUserId,
        unit: { property: { landlordId: user.id } },
      },
    });
    // Check if target is an owner managed by this PM
    const owner = await db.owner.findFirst({
      where: {
        userId: targetUserId,
        landlordId: user.id,
      },
    });
    if (!tenant && !owner)
      return NextResponse.json({ error: "Not your tenant or owner" }, { status: 403 });
  } else if (user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Only admins and property managers can send notices" },
      { status: 403 }
    );
  }

  const notice = await db.dashboardNotice.create({
    data: {
      targetUserId,
      createdById: user.id,
      type: type || "CUSTOM",
      title,
      message,
      amount: amount ? parseFloat(amount) : null,
      severity: severity || "warning",
    },
  });

  return NextResponse.json(notice, { status: 201 });
}

// PUT - Dismiss a notice
export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { noticeId } = body;

  if (!noticeId)
    return NextResponse.json({ error: "Missing noticeId" }, { status: 400 });

  await db.dashboardNotice.update({
    where: { id: noticeId, targetUserId: session.user.id },
    data: { dismissedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}

// PATCH - Mark notice(s) as read
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { noticeId, markAllRead } = body;

  if (markAllRead) {
    await db.dashboardNotice.updateMany({
      where: {
        targetUserId: session.user.id,
        readAt: null,
        dismissedAt: null,
      },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ success: true });
  }

  if (!noticeId)
    return NextResponse.json({ error: "Missing noticeId" }, { status: 400 });

  await db.dashboardNotice.update({
    where: { id: noticeId, targetUserId: session.user.id },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ success: true });
}

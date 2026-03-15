import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAdminContext, canAdmin } from "@/lib/admin-context";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminCtx = await getAdminContext(session.user.id);
  if (!canAdmin(adminCtx, "admin:audit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const requestedPerPage = parseInt(searchParams.get("perPage") || "50");
  const perPage = Math.min(Math.max(requestedPerPage, 1), 200);
  const action = searchParams.get("action");
  const objectType = searchParams.get("objectType");
  const userId = searchParams.get("userId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const search = searchParams.get("search");

  const where: Prisma.AuditLogWhereInput = {};

  if (action) where.action = action;
  if (objectType) where.objectType = objectType;
  if (userId) where.userId = userId;

  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  if (search) {
    where.OR = [
      { description: { contains: search, mode: "insensitive" } },
      { userName: { contains: search, mode: "insensitive" } },
      { objectId: { contains: search } },
    ];
  }

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.auditLog.count({ where }),
  ]);

  return NextResponse.json({
    logs,
    page,
    perPage,
    total,
    totalPages: Math.ceil(total / perPage),
  });
}

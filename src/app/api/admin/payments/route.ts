import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAdminContext, canAdmin } from "@/lib/admin-context";
import { db } from "@/lib/db";
import { PaymentStatus } from "@prisma/client";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const adminCtx = await getAdminContext(session.user.id);
  if (!canAdmin(adminCtx, "admin:payments")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const requestedPerPage = parseInt(searchParams.get("perPage") || "20");
  const perPage = Math.min(Math.max(requestedPerPage, 1), 200);
  const status = searchParams.get("status") as PaymentStatus | undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (status) where.status = status;

  const [payments, total] = await Promise.all([
    db.payment.findMany({
      where,
      include: {
        unit: {
          select: {
            unitNumber: true,
            property: { select: { name: true } },
          },
        },
        tenant: { include: { user: { select: { name: true } } } },
        landlord: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.payment.count({ where }),
  ]);

  return NextResponse.json({
    payments,
    meta: {
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage),
    },
  });
}

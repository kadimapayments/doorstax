export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/vendor/tickets
 *
 * Lists every ticket assigned to any Vendor record linked to this user.
 * Supports ?status= and ?pm= filters.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "VENDOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || undefined;
  const pmFilter = url.searchParams.get("pm") || undefined;

  const tickets = await db.serviceTicket.findMany({
    where: {
      vendor: { userId: session.user.id },
      ...(status ? { status: status as never } : {}),
      ...(pmFilter ? { landlordId: pmFilter } : {}),
    },
    include: {
      tenant: { include: { user: { select: { name: true } } } },
      unit: {
        select: {
          unitNumber: true,
          property: { select: { name: true, address: true } },
        },
      },
      landlord: { select: { id: true, name: true, companyName: true } },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  return NextResponse.json({ tickets });
}

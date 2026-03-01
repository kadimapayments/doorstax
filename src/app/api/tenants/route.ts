import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "LANDLORD") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all tenants assigned to this landlord's properties
  const tenants = await db.tenantProfile.findMany({
    where: {
      unit: {
        property: { landlordId: session.user.id },
      },
    },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      unit: {
        select: {
          unitNumber: true,
          rentAmount: true,
          property: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(tenants);
}

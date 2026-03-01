import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cookies } from "next/headers";

// POST: start impersonating a tenant
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "LANDLORD") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { tenantId } = body;

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }

  // Verify landlord owns this tenant
  const tenant = await db.tenantProfile.findFirst({
    where: {
      id: tenantId,
      unit: { property: { landlordId: session.user.id } },
    },
    include: { user: { select: { name: true } } },
  });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  // Set impersonation cookie
  const cookieStore = await cookies();
  cookieStore.set("impersonating", JSON.stringify({
    tenantId: tenant.id,
    tenantUserId: tenant.userId,
    tenantName: tenant.user.name,
    landlordId: session.user.id,
    landlordName: session.user.name,
  }), {
    path: "/",
    httpOnly: false, // Client needs to read it
    maxAge: 3600, // 1 hour
    sameSite: "lax",
  });

  return NextResponse.json({ success: true, tenantName: tenant.user.name });
}

// DELETE: stop impersonating
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("impersonating");
  return NextResponse.json({ success: true });
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hash } from "bcryptjs";
import { randomBytes } from "crypto";
import { auditLog } from "@/lib/audit";

/**
 * POST /api/tenants/[id]/reset-password
 * PM or Admin can set a temp password for a tenant.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { role } = session.user;
  if (role !== "PM" && role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: tenantId } = await params;

  // Fetch tenant profile with user
  const tenant = await db.tenantProfile.findUnique({
    where: { id: tenantId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      unit: { include: { property: { select: { landlordId: true } } } },
    },
  });

  if (!tenant || !tenant.user) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  // If PM, verify tenant belongs to their portfolio
  if (role === "PM") {
    const landlordId = tenant.unit?.property?.landlordId;
    if (landlordId !== session.user.id) {
      return NextResponse.json({ error: "Tenant not in your portfolio" }, { status: 403 });
    }
  }

  // Generate 8-char alphanumeric temp password
  const tempPassword = randomBytes(4).toString("hex"); // 8 hex chars
  const tempHash = await hash(tempPassword, 12);

  await db.user.update({
    where: { id: tenant.user.id },
    data: {
      tempPasswordHash: tempHash,
      mustChangePassword: true,
    },
  });

  auditLog({
    userId: session.user.id,
    userName: session.user.name,
    userRole: session.user.role,
    action: "RESET_PASSWORD",
    objectType: "User",
    objectId: tenant.user.id,
    description: `Reset password for tenant ${tenant.user.name} (${tenant.user.email})`,
    req,
  });

  return NextResponse.json({
    success: true,
    tempPassword,
    tenantName: tenant.user.name,
    tenantEmail: tenant.user.email,
  });
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateLeaseSchema } from "@/lib/validations/lease";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const lease = await db.lease.findUnique({
      where: { id },
      include: {
        tenant: { include: { user: { select: { name: true, email: true } } } },
        unit: { select: { unitNumber: true, rentAmount: true, property: { select: { name: true } } } },
        property: { select: { name: true } },
        addendums: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!lease) {
      return NextResponse.json({ error: "Lease not found" }, { status: 404 });
    }

    // Verify access
    if (session.user.role === "PM" && lease.landlordId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (session.user.role === "TENANT") {
      const profile = await db.tenantProfile.findUnique({
        where: { userId: session.user.id },
      });
      if (!profile || lease.tenantId !== profile.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json(lease);
  } catch (error) {
    console.error("GET /api/leases/[id] error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const lease = await db.lease.findFirst({
      where: { id, landlordId: session.user.id },
    });

    if (!lease) {
      return NextResponse.json({ error: "Lease not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = updateLeaseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid data" },
        { status: 400 }
      );
    }

    // Validate status transitions
    if (parsed.data.status) {
      const allowedTransitions: Record<string, string[]> = {
        PENDING: ["ACTIVE"],
        ACTIVE: ["EXPIRED", "TERMINATED", "RENEWED"],
      };
      const allowed = allowedTransitions[lease.status] || [];
      if (!allowed.includes(parsed.data.status)) {
        return NextResponse.json(
          { error: `Cannot transition from ${lease.status} to ${parsed.data.status}` },
          { status: 400 }
        );
      }
    }

    const updated = await db.lease.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/leases/[id] error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

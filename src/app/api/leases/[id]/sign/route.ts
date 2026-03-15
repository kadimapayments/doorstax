import { NextResponse } from "next/server";
import { resolveApiSession } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await resolveApiSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: leaseId } = await params;

  try {
    const body = await req.json();
    const { role } = body as { role: "landlord" | "tenant" };

    if (role !== "landlord" && role !== "tenant") {
      return NextResponse.json(
        { error: "Invalid role. Must be 'landlord' or 'tenant'." },
        { status: 400 }
      );
    }

    const lease = await db.lease.findUnique({ where: { id: leaseId } });
    if (!lease) {
      return NextResponse.json({ error: "Lease not found" }, { status: 404 });
    }

    const updateData =
      role === "landlord"
        ? { signedByLandlord: true, landlordSignedAt: new Date() }
        : { signedByTenant: true, tenantSignedAt: new Date() };

    let updatedLease = await db.lease.update({
      where: { id: leaseId },
      data: updateData,
    });

    // Auto-activate lease when both parties have signed
    if (
      updatedLease.signedByLandlord &&
      updatedLease.signedByTenant &&
      updatedLease.status === "PENDING"
    ) {
      updatedLease = await db.lease.update({
        where: { id: leaseId },
        data: { status: "ACTIVE" },
      });
    }

    return NextResponse.json(updatedLease);
  } catch (error) {
    console.error("POST /api/leases/[id]/sign error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

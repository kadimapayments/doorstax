import { NextResponse } from "next/server";
import { resolveApiSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await resolveApiSession();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);
  const { id } = await params;

  try {
    const vendor = await db.vendor.findFirst({
      where: { id, landlordId },
      include: {
        tickets: {
          include: {
            unit: {
              select: {
                unitNumber: true,
                property: { select: { name: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    return NextResponse.json(vendor);
  } catch {
    return NextResponse.json({ error: "Failed to fetch vendor" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await resolveApiSession();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);
  const { id } = await params;

  try {
    const existing = await db.vendor.findFirst({ where: { id, landlordId } });
    if (!existing) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    const body = await req.json();
    const {
      name,
      email,
      phone,
      company,
      category,
      notes,
      rating,
      isActive,
      taxId,
      taxIdType,
      w9Status,
      w9DocumentUrl,
    } = body;

    const VALID_W9_STATUSES = ["NOT_REQUESTED", "REQUESTED", "RECEIVED", "VERIFIED"];

    // Validate w9Status if provided
    if (w9Status !== undefined && !VALID_W9_STATUSES.includes(w9Status)) {
      return NextResponse.json(
        { error: `Invalid w9Status. Must be one of: ${VALID_W9_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate taxIdType if provided
    if (taxIdType !== undefined && taxIdType !== null && !["SSN", "EIN"].includes(taxIdType)) {
      return NextResponse.json(
        { error: "Invalid taxIdType. Must be SSN or EIN." },
        { status: 400 }
      );
    }

    const vendor = await db.vendor.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(phone !== undefined && { phone: phone?.trim() || null }),
        ...(company !== undefined && { company: company?.trim() || null }),
        ...(category !== undefined && { category }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
        ...(rating !== undefined && { rating: rating !== null ? Number(rating) : null }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        ...(taxId !== undefined && { taxId: taxId?.trim() || null }),
        ...(taxIdType !== undefined && { taxIdType: taxIdType || null }),
        ...(w9Status !== undefined && { w9Status }),
        ...(w9DocumentUrl !== undefined && { w9DocumentUrl: w9DocumentUrl || null }),
      },
    });

    return NextResponse.json(vendor);
  } catch {
    return NextResponse.json({ error: "Failed to update vendor" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await resolveApiSession();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);
  const { id } = await params;

  try {
    const existing = await db.vendor.findFirst({
      where: { id, landlordId },
      include: { _count: { select: { tickets: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    if (existing._count.tickets > 0) {
      return NextResponse.json(
        { error: "Cannot delete vendor with existing tickets. Reassign or remove tickets first." },
        { status: 400 }
      );
    }

    await db.vendor.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete vendor" }, { status: 500 });
  }
}

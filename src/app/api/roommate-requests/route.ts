import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { z } from "zod";

/* ── GET: list roommate requests ── */
/* Tenant: sees own requests. PM: sees requests for their properties. */

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role === "TENANT") {
    const profile = await db.tenantProfile.findUnique({
      where: { userId: session.user.id },
    });
    if (!profile) {
      return NextResponse.json([]);
    }

    const requests = await db.roommateRequest.findMany({
      where: { tenantProfileId: profile.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(requests);
  }

  if (session.user.role === "PM") {
    const requests = await db.roommateRequest.findMany({
      where: { landlordId: session.user.id },
      include: {
        tenantProfile: {
          include: {
            user: { select: { name: true, email: true } },
          },
        },
        unit: {
          select: {
            unitNumber: true,
            property: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const rows = requests.map((r) => ({
      id: r.id,
      tenantName: r.tenantProfile.user.name,
      tenantEmail: r.tenantProfile.user.email,
      property: r.unit.property.name,
      unit: r.unit.unitNumber,
      roommateName: r.name,
      roommateEmail: r.email,
      roommatePhone: r.phone,
      status: r.status,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
      processedAt: r.processedAt?.toISOString() || null,
    }));

    return NextResponse.json(rows);
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/* ── POST: create roommate request (tenant only) ── */

const requestSchema = z.object({
  roommates: z.array(
    z.object({
      name: z.string().min(1, "Name is required"),
      email: z.string().email("Valid email required"),
      phone: z.string().optional(),
    })
  ).min(1, "At least one roommate is required"),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "TENANT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = requestSchema.parse(body);

    const profile = await db.tenantProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        user: { select: { name: true } },
        unit: {
          select: {
            id: true,
            unitNumber: true,
            property: { select: { name: true, landlordId: true } },
          },
        },
      },
    });

    if (!profile || !profile.unit) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const landlordId = profile.unit.property.landlordId;

    // Create all roommate requests
    const created = await db.roommateRequest.createMany({
      data: data.roommates.map((rm) => ({
        tenantProfileId: profile.id,
        unitId: profile.unit!.id,
        landlordId,
        name: rm.name,
        email: rm.email,
        phone: rm.phone || null,
      })),
    });

    // Notify PM about pending roommate requests
    const landlord = await db.user.findUnique({
      where: { id: landlordId },
      select: { email: true },
    });

    if (landlord) {
      await notify({
        userId: landlordId,
        createdById: session.user.id,
        type: "ROOMMATE_REQUEST",
        title: "Roommate Approval Needed",
        message: `${profile.user.name} has requested to add ${data.roommates.length} roommate(s) to ${profile.unit.property.name} - Unit ${profile.unit.unitNumber}. Please review and approve.`,
        severity: "warning",
      });
    }

    return NextResponse.json(
      { success: true, count: created.count },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

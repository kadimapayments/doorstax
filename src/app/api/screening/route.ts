import { NextResponse } from "next/server";
import { resolveApiSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { createApplyLink, isRentSpreeConfigured } from "@/lib/rentspree";

// GET: list all screening requests for this PM
export async function GET() {
  const session = await resolveApiSession();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);

  try {
    const screenings = await db.tenantScreening.findMany({
      where: { landlordId },
      include: {
        application: {
          select: {
            id: true,
            name: true,
            email: true,
            unit: {
              select: {
                unitNumber: true,
                property: { select: { name: true, address: true } },
              },
            },
          },
        },
      },
      orderBy: { requestedAt: "desc" },
    });

    return NextResponse.json({
      screenings,
      configured: isRentSpreeConfigured(),
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch screenings" }, { status: 500 });
  }
}

// POST: request a new screening for an application
export async function POST(req: Request) {
  const session = await resolveApiSession();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);

  try {
    const { applicationId } = await req.json();

    if (!applicationId) {
      return NextResponse.json({ error: "applicationId is required" }, { status: 400 });
    }

    // Verify application belongs to this PM
    const application = await db.application.findFirst({
      where: {
        id: applicationId,
        unit: { property: { landlordId } },
      },
      include: {
        unit: {
          select: {
            unitNumber: true,
            property: { select: { name: true, address: true } },
          },
        },
        screenings: { take: 1, orderBy: { requestedAt: "desc" } },
      },
    });

    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    // Check if there's already an active screening
    const activeScreening = application.screenings.find(
      (s) => s.status === "PENDING" || s.status === "IN_PROGRESS"
    );
    if (activeScreening) {
      return NextResponse.json(
        { error: "A screening is already in progress for this application" },
        { status: 400 }
      );
    }

    // Get the PM's info
    const pm = await db.user.findUnique({
      where: { id: landlordId },
      select: { email: true, name: true },
    });

    if (!isRentSpreeConfigured()) {
      // Create a placeholder screening record (no actual API call)
      const screening = await db.tenantScreening.create({
        data: {
          applicationId,
          landlordId,
          status: "PENDING",
        },
      });

      return NextResponse.json({
        ...screening,
        warning: "RentSpree integration is not configured. Screening created as placeholder.",
      }, { status: 201 });
    }

    // Call RentSpree API
    const result = await createApplyLink({
      applicantEmail: application.email,
      applicantName: application.name,
      propertyAddress: `${application.unit.property.address || application.unit.property.name}`,
      unitNumber: application.unit.unitNumber,
      landlordEmail: pm?.email || session.user.email || "",
      landlordName: pm?.name || "Property Manager",
    });

    // Create screening record
    const screening = await db.tenantScreening.create({
      data: {
        applicationId,
        landlordId,
        rentspreeId: result.id,
        applyLink: result.applyLink,
        status: "PENDING",
      },
    });

    return NextResponse.json(screening, { status: 201 });
  } catch (e) {
    console.error("Screening request error:", e);
    return NextResponse.json({ error: "Failed to request screening" }, { status: 500 });
  }
}

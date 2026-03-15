import { NextResponse } from "next/server";
import { resolveApiSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { getScreeningStatus, isRentSpreeConfigured, mapRentSpreeStatus } from "@/lib/rentspree";

// GET: get screening details + optionally refresh from RentSpree
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await resolveApiSession();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);
  const { id } = await params;

  try {
    const screening = await db.tenantScreening.findFirst({
      where: { id, landlordId },
      include: {
        application: {
          select: {
            id: true,
            name: true,
            email: true,
            unit: {
              select: {
                unitNumber: true,
                property: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!screening) {
      return NextResponse.json({ error: "Screening not found" }, { status: 404 });
    }

    // If RentSpree is configured and screening is pending/in-progress, refresh status
    if (
      isRentSpreeConfigured() &&
      screening.rentspreeId &&
      (screening.status === "PENDING" || screening.status === "IN_PROGRESS")
    ) {
      try {
        const rsStatus = await getScreeningStatus(screening.rentspreeId);
        const newStatus = mapRentSpreeStatus(rsStatus.status);

        if (newStatus !== screening.status || rsStatus.creditScore) {
          const updated = await db.tenantScreening.update({
            where: { id },
            data: {
              status: newStatus,
              creditScore: rsStatus.creditScore ?? screening.creditScore,
              creditResult: rsStatus.creditResult ?? screening.creditResult,
              criminalResult: rsStatus.criminalResult ?? screening.criminalResult,
              evictionResult: rsStatus.evictionResult ?? screening.evictionResult,
              completedAt: newStatus === "COMPLETED" ? new Date() : screening.completedAt,
            },
            include: {
              application: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  unit: {
                    select: {
                      unitNumber: true,
                      property: { select: { name: true } },
                    },
                  },
                },
              },
            },
          });

          return NextResponse.json(updated);
        }
      } catch (e) {
        // If RentSpree API fails, return cached data
        console.error("RentSpree status check failed:", e);
      }
    }

    return NextResponse.json(screening);
  } catch {
    return NextResponse.json({ error: "Failed to fetch screening" }, { status: 500 });
  }
}

// DELETE: cancel a pending screening
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await resolveApiSession();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);
  const { id } = await params;

  try {
    const screening = await db.tenantScreening.findFirst({
      where: { id, landlordId },
    });

    if (!screening) {
      return NextResponse.json({ error: "Screening not found" }, { status: 404 });
    }

    if (screening.status === "COMPLETED") {
      return NextResponse.json({ error: "Cannot cancel a completed screening" }, { status: 400 });
    }

    const updated = await db.tenantScreening.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to cancel screening" }, { status: 500 });
  }
}

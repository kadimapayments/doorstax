import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getPmCalendarEvents,
  getTenantCalendarEvents,
  getOwnerCalendarEvents,
} from "@/lib/calendar-events";
import { generateIcalFeed } from "@/lib/ical-generator";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const calToken = await db.calendarToken.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
  });

  if (!calToken || calToken.revokedAt) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const user = calToken.user;

  // ±6 month range
  const now = new Date();
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 7, 0);

  try {
    let events;
    let calName = "DoorStax Calendar";

    if (user.role === "PM" || user.role === "ADMIN") {
      // Resolve landlordId — same logic as getEffectiveLandlordId
      const membership = await db.teamMember.findFirst({
        where: { userId: user.id, isActive: true },
        select: { landlordId: true },
      });
      const landlordId = membership ? membership.landlordId : user.id;
      events = await getPmCalendarEvents(landlordId, rangeStart, rangeEnd);
      calName = "DoorStax — Property Manager";
    } else if (user.role === "TENANT") {
      const profile = await db.tenantProfile.findUnique({
        where: { userId: user.id },
        select: { id: true, unitId: true },
      });
      if (!profile || !profile.unitId) {
        return new NextResponse("Tenant profile not found", { status: 404 });
      }
      events = await getTenantCalendarEvents(
        profile.id,
        profile.unitId,
        rangeStart,
        rangeEnd
      );
      calName = "DoorStax — Tenant";
    } else if (user.role === "OWNER") {
      const owner = await db.owner.findFirst({
        where: { userId: user.id },
      });
      if (!owner) {
        return new NextResponse("Owner profile not found", { status: 404 });
      }
      events = await getOwnerCalendarEvents(
        owner.id,
        owner.landlordId,
        rangeStart,
        rangeEnd
      );
      calName = "DoorStax — Owner";
    } else {
      return new NextResponse("Unsupported role", { status: 403 });
    }

    const ics = generateIcalFeed(events, calName);

    return new NextResponse(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": "inline; filename=doorstax-calendar.ics",
        "Cache-Control": "public, max-age=900",
      },
    });
  } catch (error) {
    console.error("iCal feed error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

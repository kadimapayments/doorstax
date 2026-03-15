import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import {
  getPmCalendarEvents,
  getTenantCalendarEvents,
  getOwnerCalendarEvents,
} from "@/lib/calendar-events";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");

  if (!startParam || !endParam) {
    return NextResponse.json(
      { error: "start and end query params required" },
      { status: 400 }
    );
  }

  const rangeStart = new Date(startParam);
  const rangeEnd = new Date(endParam);

  if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) {
    return NextResponse.json(
      { error: "Invalid date format" },
      { status: 400 }
    );
  }

  try {
    const role = session.user.role;

    if (role === "PM" || role === "ADMIN") {
      const landlordId = await getEffectiveLandlordId(session.user.id);
      const events = await getPmCalendarEvents(landlordId, rangeStart, rangeEnd);
      return NextResponse.json(events);
    }

    if (role === "TENANT") {
      const profile = await db.tenantProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true, unitId: true },
      });
      if (!profile || !profile.unitId) {
        return NextResponse.json({ error: "Tenant profile not found" }, { status: 404 });
      }
      const events = await getTenantCalendarEvents(
        profile.id,
        profile.unitId,
        rangeStart,
        rangeEnd
      );
      return NextResponse.json(events);
    }

    if (role === "OWNER") {
      const owner = await db.owner.findFirst({
        where: { userId: session.user.id },
      });
      if (!owner) {
        return NextResponse.json({ error: "Owner profile not found" }, { status: 404 });
      }
      const landlordId = owner.landlordId;
      const events = await getOwnerCalendarEvents(
        owner.id,
        landlordId,
        rangeStart,
        rangeEnd
      );
      return NextResponse.json(events);
    }

    return NextResponse.json({ error: "Unsupported role" }, { status: 403 });
  } catch (error) {
    console.error("Calendar events error:", error);
    return NextResponse.json(
      { error: "Failed to load calendar events" },
      { status: 500 }
    );
  }
}

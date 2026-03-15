import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { applicationSchema } from "@/lib/validations/application";
import { z } from "zod";
import { checkIp, getClientIp } from "@/lib/ip-check";
import { publicLimiter, getClientIp as getRateLimitIp, rateLimitResponse } from "@/lib/rate-limit";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const applications = await db.application.findMany({
      where: {
        unit: { property: { landlordId: session.user.id } },
      },
      include: {
        unit: {
          select: {
            unitNumber: true,
            property: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(applications);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Public — no auth required
export async function POST(req: Request) {
  try {
    // ─── Rate Limiting (by IP) ──────────────────────────────────
    const rl = await publicLimiter.limit(getRateLimitIp(req));
    if (!rl.success) return rateLimitResponse(rl.reset);

    const body = await req.json();
    const data = applicationSchema.parse(body);

    // ─── IP Security Check (VPN + Geo) ────────────────────────
    const ipCheck = await checkIp(getClientIp(req));
    if (!ipCheck.allowed) {
      return NextResponse.json(
        { error: ipCheck.message, code: ipCheck.code },
        { status: 403 }
      );
    }

    // Verify the unit exists and accepts applications
    const unit = await db.unit.findUnique({
      where: { id: data.unitId },
    });

    if (!unit || !unit.applicationsEnabled) {
      return NextResponse.json(
        { error: "This unit is not accepting applications" },
        { status: 400 }
      );
    }

    const application = await db.application.create({ data });
    return NextResponse.json(application, { status: 201 });
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

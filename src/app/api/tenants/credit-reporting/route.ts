import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-utils";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const user = await requireRole("TENANT");

  try {
    const { action } = await req.json();

    if (action !== "enroll" && action !== "unenroll") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const profile = await db.tenantProfile.update({
      where: { userId: user.id },
      data: {
        creditReportingEnrolled: action === "enroll",
        creditReportingEnrolledAt: action === "enroll" ? new Date() : null,
      },
    });

    return NextResponse.json({
      creditReportingEnrolled: profile.creditReportingEnrolled,
      creditReportingEnrolledAt: profile.creditReportingEnrolledAt,
    });
  } catch (error) {
    console.error("Credit reporting error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET() {
  const user = await requireRole("TENANT");

  const profile = await db.tenantProfile.findUnique({
    where: { userId: user.id },
    select: {
      creditReportingEnrolled: true,
      creditReportingEnrolledAt: true,
    },
  });

  return NextResponse.json(profile);
}

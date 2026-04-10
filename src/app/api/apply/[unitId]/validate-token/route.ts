import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ unitId: string }> }
) {
  try {
    const { unitId } = await params;
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json(
        { valid: false, error: "No token provided" },
        { status: 400 }
      );
    }

    const record = await db.applicationToken.findUnique({
      where: { token },
    });

    if (!record) {
      return NextResponse.json({ valid: false, error: "Invalid link" });
    }
    if (record.unitId !== unitId) {
      return NextResponse.json({ valid: false, error: "Invalid link" });
    }
    if (record.usedAt) {
      return NextResponse.json({
        valid: false,
        error: "This link has already been used",
      });
    }
    if (record.expiresAt < new Date()) {
      return NextResponse.json({
        valid: false,
        error: "This link has expired. Please request a new one.",
      });
    }

    return NextResponse.json({
      valid: true,
      email: record.email,
    });
  } catch (err) {
    console.error("[apply/validate-token] Error:", err);
    return NextResponse.json(
      { valid: false, error: "Validation failed" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "PM" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fieldIds } = await req.json();
    if (!Array.isArray(fieldIds)) {
      return NextResponse.json({ error: "fieldIds array is required" }, { status: 400 });
    }

    // Update sortOrder for each field
    await Promise.all(
      fieldIds.map((id: string, index: number) =>
        db.applicationField.updateMany({
          where: { id, pmId: session.user.id },
          data: { sortOrder: index },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[application-fields/reorder] error:", err);
    return NextResponse.json({ error: "Failed to reorder fields" }, { status: 500 });
  }
}

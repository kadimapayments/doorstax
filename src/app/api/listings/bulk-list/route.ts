import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST() {
  try {
    const session = await auth();
    if (
      !session?.user?.id ||
      (session.user.role !== "PM" && session.user.role !== "ADMIN")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // List all available/vacant units belonging to this PM that aren't already listed
    const result = await db.unit.updateMany({
      where: {
        property: { landlordId: session.user.id },
        status: "AVAILABLE",
        listingEnabled: false,
      },
      data: { listingEnabled: true },
    });

    return NextResponse.json({ count: result.count });
  } catch (err) {
    console.error("[listings/bulk-list] error:", err);
    return NextResponse.json(
      { error: "Failed to bulk list units" },
      { status: 500 }
    );
  }
}

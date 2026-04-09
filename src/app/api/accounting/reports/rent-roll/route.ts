import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateRentRoll } from "@/lib/accounting/reports";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "PM" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const report = await generateRentRoll(session.user.id);
    return NextResponse.json(report);
  } catch (err) {
    console.error("[accounting/reports/rent-roll] error:", err);
    return NextResponse.json({ error: "Failed to generate rent roll" }, { status: 500 });
  }
}

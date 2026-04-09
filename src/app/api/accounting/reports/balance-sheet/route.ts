import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateBalanceSheet } from "@/lib/accounting/reports";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "PM" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const asOfDate = new Date(searchParams.get("asOfDate") || new Date().toISOString());
    const propertyId = searchParams.get("propertyId") || undefined;

    const report = await generateBalanceSheet(session.user.id, asOfDate, propertyId);
    return NextResponse.json(report);
  } catch (err) {
    console.error("[accounting/reports/balance-sheet] error:", err);
    return NextResponse.json({ error: "Failed to generate balance sheet" }, { status: 500 });
  }
}

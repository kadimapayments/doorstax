import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateCashFlow } from "@/lib/accounting/reports";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "PM" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const now = new Date();
    const startDate = new Date(searchParams.get("startDate") || new Date(now.getFullYear(), now.getMonth(), 1).toISOString());
    const endDate = new Date(searchParams.get("endDate") || now.toISOString());
    const propertyId = searchParams.get("propertyId") || undefined;

    const report = await generateCashFlow({ pmId: session.user.id, startDate, endDate, propertyId });
    return NextResponse.json(report);
  } catch (err) {
    console.error("[accounting/reports/cash-flow] error:", err);
    return NextResponse.json({ error: "Failed to generate cash flow" }, { status: 500 });
  }
}

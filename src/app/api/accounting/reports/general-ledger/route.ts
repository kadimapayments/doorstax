import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateGeneralLedger } from "@/lib/accounting/reports";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "PM" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId");
    if (!accountId) {
      return NextResponse.json({ error: "accountId is required" }, { status: 400 });
    }
    const now = new Date();
    const startDate = new Date(searchParams.get("startDate") || new Date(now.getFullYear(), now.getMonth(), 1).toISOString());
    const endDate = new Date(searchParams.get("endDate") || now.toISOString());

    const report = await generateGeneralLedger(session.user.id, accountId, startDate, endDate);
    return NextResponse.json(report);
  } catch (err) {
    console.error("[accounting/reports/general-ledger] error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

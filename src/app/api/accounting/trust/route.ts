import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTrustAccountStatus } from "@/lib/accounting/trust-accounting";
import { seedDefaultAccounts } from "@/lib/accounting/chart-of-accounts";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "PM" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await seedDefaultAccounts(session.user.id);
    const status = await getTrustAccountStatus(session.user.id);
    return NextResponse.json(status);
  } catch (err) {
    console.error("[accounting/trust] error:", err);
    return NextResponse.json({ error: "Failed to get trust status" }, { status: 500 });
  }
}

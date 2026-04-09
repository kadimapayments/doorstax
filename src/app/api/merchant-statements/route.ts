import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { listStatements } from "@/lib/kadima/reporting";
import { getMerchantCredentials } from "@/lib/kadima/merchant-context";

export async function GET() {
  try {
    const session = await auth();
    if (
      !session?.user?.id ||
      (session.user.role !== "PM" && session.user.role !== "ADMIN")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve merchant credentials + DBA ID
    const merchantApp = await db.merchantApplication.findUnique({
      where: { userId: session.user.id },
      select: { status: true, dba: true, kadimaAppId: true },
    });

    if (!merchantApp) {
      return NextResponse.json({
        configured: false,
        reason: "no_merchant",
      });
    }

    if (merchantApp.status !== "APPROVED") {
      return NextResponse.json({
        configured: false,
        reason: "pending_approval",
        status: merchantApp.status,
      });
    }

    // Get DBA ID from env (global for now) or merchant app
    const dbaId = Number(
      process.env.KADIMA_DBA_ID || merchantApp.kadimaAppId || "0"
    );
    if (!dbaId) {
      return NextResponse.json({
        configured: false,
        reason: "no_dba_id",
      });
    }

    let apiToken: string;
    try {
      const creds = await getMerchantCredentials(session.user.id);
      apiToken = creds.apiKey;
    } catch {
      return NextResponse.json({
        configured: false,
        reason: "no_credentials",
      });
    }

    const data = await listStatements(dbaId, apiToken);

    return NextResponse.json({
      configured: true,
      dbaId,
      dbaName: merchantApp.dba || "Merchant",
      statements: data.items || data || [],
    });
  } catch (err) {
    console.error("[merchant-statements] GET error:", err);
    return NextResponse.json(
      { error: "Failed to fetch statements" },
      { status: 500 }
    );
  }
}

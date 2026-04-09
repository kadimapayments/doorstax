import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMonthlyReportingData } from "@/lib/kadima/reporting";
import { getMerchantCredentials } from "@/lib/kadima/merchant-context";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (
      !session?.user?.id ||
      (session.user.role !== "PM" && session.user.role !== "ADMIN")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const year = Number(searchParams.get("year") || new Date().getFullYear());
    const month = Number(searchParams.get("month") || new Date().getMonth() + 1);

    // Resolve DBA ID
    const merchantApp = await db.merchantApplication.findUnique({
      where: { userId: session.user.id },
      select: { kadimaAppId: true, status: true },
    });

    if (!merchantApp || merchantApp.status !== "APPROVED") {
      return NextResponse.json(
        { error: "Merchant application not approved" },
        { status: 400 }
      );
    }

    const dbaId = Number(
      process.env.KADIMA_DBA_ID || merchantApp.kadimaAppId || "0"
    );
    if (!dbaId) {
      return NextResponse.json(
        { error: "DBA ID not configured" },
        { status: 400 }
      );
    }

    const creds = await getMerchantCredentials(session.user.id);
    const data = await getMonthlyReportingData(
      dbaId,
      creds.apiKey,
      year,
      month
    );

    return NextResponse.json(data);
  } catch (err) {
    console.error("[merchant-statements/reporting] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch reporting data" },
      { status: 500 }
    );
  }
}

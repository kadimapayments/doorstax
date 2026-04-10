import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const result = await db.applicationToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() }, createdAt: { lt: sevenDaysAgo } },
          { usedAt: { not: null }, createdAt: { lt: sevenDaysAgo } },
        ],
      },
    });

    return NextResponse.json({
      success: true,
      deleted: result.count,
    });
  } catch (err) {
    console.error("[cron/cleanup-tokens] Error:", err);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}

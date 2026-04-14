import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/track/proposal-open?q={quoteId}
 * Returns a 1x1 transparent GIF and records the email open.
 */
export async function GET(req: NextRequest) {
  const quoteId = req.nextUrl.searchParams.get("q");

  if (quoteId) {
    try {
      const existing = await db.proposalQuote.findUnique({
        where: { quoteId },
        select: { openedAt: true },
      });
      await db.proposalQuote.update({
        where: { quoteId },
        data: {
          openedAt: existing?.openedAt || new Date(),
          openCount: { increment: 1 },
          ...(existing?.openedAt ? {} : { status: "OPENED" }),
        },
      });
    } catch {}
  }

  const pixel = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64"
  );
  return new NextResponse(pixel, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache",
    },
  });
}

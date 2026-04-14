import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/track/proposal-click?q={quoteId}
 * Records the CTA click and redirects to /register (with agent referral code if available).
 */
export async function GET(req: NextRequest) {
  const quoteId = req.nextUrl.searchParams.get("q");
  const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com";
  let redirectUrl = BASE + "/register";

  if (quoteId) {
    try {
      const proposal = await db.proposalQuote.update({
        where: { quoteId },
        data: {
          clickedAt: new Date(),
          status: "CLICKED",
        },
        include: {
          agent: { select: { user: { select: { referralCode: true } } } },
        },
      });

      const refCode = proposal.agent?.user?.referralCode;
      if (refCode) {
        redirectUrl += "?ref=" + refCode;
      }
    } catch {}
  }

  return NextResponse.redirect(redirectUrl);
}

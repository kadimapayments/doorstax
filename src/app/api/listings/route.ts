import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { publicLimiter, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

// Public — lists all enabled listings
export async function GET(req: Request) {
  // ─── Rate Limiting (by IP) ──────────────────────────────────
  const rl = await publicLimiter.limit(getClientIp(req));
  if (!rl.success) return rateLimitResponse(rl.reset);

  const listings = await db.unit.findMany({
    where: { listingEnabled: true, status: "AVAILABLE" },
    include: {
      property: {
        select: { name: true, address: true, city: true, state: true, zip: true, photos: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(listings);
}

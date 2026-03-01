import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Public — lists all enabled listings
export async function GET() {
  const listings = await db.unit.findMany({
    where: { listingEnabled: true, status: "AVAILABLE" },
    include: {
      property: {
        select: { name: true, address: true, city: true, state: true, zip: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(listings);
}

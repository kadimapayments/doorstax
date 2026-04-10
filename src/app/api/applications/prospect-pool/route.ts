import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Prospect Pool — applicants who requested an application link but didn't
 * complete it, AND the unit they were interested in is now filled or delisted.
 *
 * Returns ApplicationToken records grouped by email with the relevant unit info.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "PM") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find tokens where:
    // - Not used (never submitted)
    // - The unit belongs to this PM
    // - The unit is either occupied, delisted, or the token expired
    const tokens = await db.applicationToken.findMany({
      where: {
        usedAt: null,
        unit: {
          property: { landlordId: session.user.id },
        },
      },
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
            status: true,
            listingEnabled: true,
            property: { select: { name: true } },
            tenantProfiles: { select: { id: true }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Filter to only those whose units are no longer available or expired
    const now = new Date();
    const pool = tokens
      .filter((t) => {
        const unit = t.unit;
        if (!unit) return false;
        const isExpired = t.expiresAt < now;
        const isFilled = unit.tenantProfiles.length > 0;
        const isDelisted = unit.listingEnabled === false;
        const isOccupied = unit.status !== "AVAILABLE";
        return isExpired || isFilled || isDelisted || isOccupied;
      })
      .map((t) => ({
        id: t.id,
        email: t.email,
        createdAt: t.createdAt,
        clickedAt: t.clickedAt,
        clickCount: t.clickCount,
        remindersSent: t.remindersSent,
        expiresAt: t.expiresAt,
        marketingOptOut: t.marketingOptOut,
        reason: t.expiresAt < now
          ? "EXPIRED"
          : t.unit?.tenantProfiles && t.unit.tenantProfiles.length > 0
            ? "UNIT_FILLED"
            : t.unit?.listingEnabled === false
              ? "UNIT_DELISTED"
              : "UNIT_OCCUPIED",
        unit: {
          id: t.unit?.id,
          unitNumber: t.unit?.unitNumber,
          propertyName: t.unit?.property?.name,
        },
      }));

    // Deduplicate by email — keep the most recent
    const byEmail = new Map<string, (typeof pool)[0]>();
    for (const entry of pool) {
      const existing = byEmail.get(entry.email);
      if (!existing || entry.createdAt > existing.createdAt) {
        byEmail.set(entry.email, entry);
      }
    }

    return NextResponse.json({
      leads: Array.from(byEmail.values()),
      count: byEmail.size,
    });
  } catch (err) {
    console.error("[prospect-pool] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch prospect pool" },
      { status: 500 }
    );
  }
}

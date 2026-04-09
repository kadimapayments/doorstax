import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateApplyLink, isRentSpreeConfigured } from "@/lib/rentspree/client";
import { resolveScreeningConfig } from "@/lib/rentspree/screening-config";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (
      !session?.user?.id ||
      (session.user.role !== "PM" && session.user.role !== "ADMIN")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { unitId } = await req.json();
    if (!unitId) {
      return NextResponse.json(
        { error: "unitId is required" },
        { status: 400 }
      );
    }

    // Verify PM owns this unit
    const unit = await db.unit.findFirst({
      where: {
        id: unitId,
        property: { landlordId: session.user.id },
      },
      select: { id: true },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    if (!isRentSpreeConfigured()) {
      // Mock mode — return a fake link for testing
      const mockLink = `https://apply.link/mock-${unitId.slice(0, 6)}`;
      await db.unit.update({
        where: { id: unitId },
        data: {
          applyLink: mockLink,
          applyLinkFull: `https://partner.rentspree.com/apply/mock-${unitId}`,
          rentspreeScreeningOptId: `mock-${Date.now()}`,
          applyLinkGeneratedAt: new Date(),
        },
      });
      return NextResponse.json({
        applyLink: mockLink,
        fullLink: `https://partner.rentspree.com/apply/mock-${unitId}`,
        mock: true,
      });
    }

    const config = await resolveScreeningConfig(unitId, session.user.id);
    const result = await generateApplyLink(config);

    // Store on unit
    await db.unit.update({
      where: { id: unitId },
      data: {
        applyLink: result.applyLink.shortenLink,
        applyLinkFull: result.applyLink.fullLink,
        rentspreeScreeningOptId: result.screeningOption._id,
        applyLinkGeneratedAt: new Date(),
      },
    });

    return NextResponse.json({
      applyLink: result.applyLink.shortenLink,
      fullLink: result.applyLink.fullLink,
      screeningOptionId: result.screeningOption._id,
    });
  } catch (err) {
    console.error("[rentspree/generate-link]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to generate apply link",
      },
      { status: 500 }
    );
  }
}

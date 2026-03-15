import { NextResponse } from "next/server";
import { resolveApiSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { generateOwnerStatementPdf } from "@/lib/statement-generator";

export async function GET(req: Request) {
  const session = await resolveApiSession();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);

  const { searchParams } = new URL(req.url);
  const ownerId = searchParams.get("ownerId");
  const month = parseInt(searchParams.get("month") || "", 10);
  const year = parseInt(searchParams.get("year") || "", 10);

  if (!ownerId || isNaN(month) || isNaN(year)) {
    return NextResponse.json(
      { error: "ownerId, month, and year are required" },
      { status: 400 }
    );
  }

  // Verify owner belongs to this landlord
  const owner = await db.owner.findFirst({
    where: { id: ownerId, landlordId },
    select: { id: true, name: true },
  });

  if (!owner) {
    return NextResponse.json({ error: "Owner not found" }, { status: 404 });
  }

  try {
    const { buffer, ownerName } = await generateOwnerStatementPdf(
      ownerId,
      landlordId,
      month,
      year
    );

    const monthName = new Date(year, month - 1, 1).toLocaleString("en-US", {
      month: "long",
    });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="payout-statement-${ownerName.replace(/\s+/g, "-")}-${monthName}-${year}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Statement generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate statement" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateOwnerStatementPdf } from "@/lib/statement-generator";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payoutId = req.nextUrl.searchParams.get("payoutId");
  if (!payoutId) return NextResponse.json({ error: "Missing payoutId" }, { status: 400 });

  const owner = await db.owner.findFirst({ where: { userId: session.user.id } });
  if (!owner) return NextResponse.json({ error: "Owner not found" }, { status: 404 });

  const payout = await db.ownerPayout.findFirst({
    where: { id: payoutId, ownerId: owner.id },
  });

  if (!payout) return NextResponse.json({ error: "Payout not found" }, { status: 404 });

  try {
    const month = payout.periodStart.getMonth() + 1; // 1-indexed for generateOwnerStatementPdf
    const year = payout.periodStart.getFullYear();

    const { buffer } = await generateOwnerStatementPdf(
      owner.id,
      payout.landlordId,
      month,
      year
    );

    const periodLabel = `${year}-${String(month).padStart(2, "0")}`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="statement-${periodLabel}.pdf"`,
      },
    });
  } catch (err) {
    console.error("PDF generation error:", err);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}

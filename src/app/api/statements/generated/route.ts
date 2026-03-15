import { NextResponse } from "next/server";
import { resolveApiSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { generateOwnerStatementPdf } from "@/lib/statement-generator";
import { uploadStatementPdf } from "@/lib/blob-storage";
import { sendOwnerStatement } from "@/lib/emails/owner-statement";
import { formatMoney } from "@/lib/pdf-utils";

// GET: List generated statements (OwnerDocuments of type STATEMENT)
export async function GET(req: Request) {
  const session = await resolveApiSession();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);

  const { searchParams } = new URL(req.url);
  const ownerId = searchParams.get("ownerId");
  const year = searchParams.get("year");

  // Get all owners for this landlord
  const ownerIds = await db.owner
    .findMany({
      where: { landlordId, ...(ownerId ? { id: ownerId } : {}) },
      select: { id: true },
    })
    .then((owners) => owners.map((o) => o.id));

  if (ownerIds.length === 0) {
    return NextResponse.json({ documents: [] });
  }

  const documents = await db.ownerDocument.findMany({
    where: {
      ownerId: { in: ownerIds },
      type: "STATEMENT",
      ...(year ? { period: { startsWith: year } } : {}),
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    documents: documents.map((d) => ({
      id: d.id,
      ownerId: d.owner.id,
      ownerName: d.owner.name,
      ownerEmail: d.owner.email,
      name: d.name,
      url: d.url,
      period: d.period,
      createdAt: d.createdAt.toISOString(),
    })),
  });
}

// POST: Manually generate a statement for a specific owner/month
export async function POST(req: Request) {
  const session = await resolveApiSession();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);

  const body = await req.json();
  const { ownerId, month, year } = body;

  if (!ownerId || !month || !year) {
    return NextResponse.json(
      { error: "ownerId, month, and year are required" },
      { status: 400 }
    );
  }

  // Verify owner belongs to this landlord
  const owner = await db.owner.findFirst({
    where: { id: ownerId, landlordId },
    select: { id: true, name: true, email: true },
  });

  if (!owner) {
    return NextResponse.json({ error: "Owner not found" }, { status: 404 });
  }

  const period = `${year}-${String(month).padStart(2, "0")}`;

  try {
    // Generate PDF
    const { buffer, netPayout, ownerName } = await generateOwnerStatementPdf(
      ownerId,
      landlordId,
      month,
      year
    );

    // Upload to Vercel Blob
    const url = await uploadStatementPdf(buffer, ownerName, period);

    // Delete existing statement for this period if regenerating
    await db.ownerDocument.deleteMany({
      where: { ownerId, type: "STATEMENT", period },
    });

    // Create new OwnerDocument record
    const monthName = new Date(year, month - 1, 1).toLocaleString("en-US", {
      month: "long",
    });

    const document = await db.ownerDocument.create({
      data: {
        ownerId,
        name: `Payout Statement — ${monthName} ${year}`,
        url,
        type: "STATEMENT",
        period,
      },
    });

    // Send email if owner has email
    if (owner.email) {
      const landlordUser = await db.user.findUnique({
        where: { id: landlordId },
        select: { companyName: true },
      });

      try {
        await sendOwnerStatement({
          ownerEmail: owner.email,
          ownerName,
          period: `${monthName} ${year}`,
          statementUrl: url,
          companyName: landlordUser?.companyName || "DoorStax",
          netPayout: formatMoney(netPayout),
        });
      } catch (emailErr) {
        console.error("Email send failed:", emailErr);
        // Don't fail the response — document was created successfully
      }
    }

    return NextResponse.json({
      id: document.id,
      url: document.url,
      period,
      ownerName,
    });
  } catch (error) {
    console.error("Statement generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate statement" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { resolveApiSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { sendOwnerStatement } from "@/lib/emails/owner-statement";
import { formatMoney } from "@/lib/pdf-utils";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await resolveApiSession();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);
  const { id } = await params;

  // Find the document
  const document = await db.ownerDocument.findUnique({
    where: { id },
    include: {
      owner: {
        select: { id: true, name: true, email: true, landlordId: true },
      },
    },
  });

  if (!document || document.owner.landlordId !== landlordId) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  if (!document.owner.email) {
    return NextResponse.json(
      { error: "Owner has no email address" },
      { status: 400 }
    );
  }

  // Get the payout for this period to show net amount
  const [yearStr, monthStr] = (document.period || "").split("-");
  const month = parseInt(monthStr || "0", 10);
  const year = parseInt(yearStr || "0", 10);

  let netPayoutDisplay = "";

  if (month && year) {
    const payout = await db.ownerPayout.findFirst({
      where: {
        ownerId: document.owner.id,
        landlordId,
        periodStart: {
          gte: new Date(year, month - 1, 1),
          lt: new Date(year, month, 1),
        },
      },
      select: { netPayout: true },
    });

    netPayoutDisplay = payout ? formatMoney(Number(payout.netPayout)) : "See statement";
  }

  const landlordUser = await db.user.findUnique({
    where: { id: landlordId },
    select: { companyName: true },
  });

  const monthName = month
    ? new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long" })
    : "";
  const periodDisplay = monthName ? `${monthName} ${year}` : document.period || "";

  try {
    await sendOwnerStatement({
      ownerEmail: document.owner.email,
      ownerName: document.owner.name,
      period: periodDisplay,
      statementUrl: document.url,
      companyName: landlordUser?.companyName || "DoorStax",
      netPayout: netPayoutDisplay,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Email resend error:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}

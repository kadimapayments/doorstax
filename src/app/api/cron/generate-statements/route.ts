import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateOwnerStatementPdf } from "@/lib/statement-generator";
import { uploadStatementPdf } from "@/lib/blob-storage";
import { sendOwnerStatement } from "@/lib/emails/owner-statement";
import { formatMoney } from "@/lib/pdf-utils";

export async function GET(req: Request) {
  // Verify cron secret (Vercel sends this automatically)
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Calculate previous month
  const now = new Date();
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const month = prevDate.getMonth() + 1; // 1-indexed
  const year = prevDate.getFullYear();
  const period = `${year}-${String(month).padStart(2, "0")}`;

  // Find all PAID payouts for the previous month
  const payouts = await db.ownerPayout.findMany({
    where: {
      status: "PAID",
      periodStart: {
        gte: new Date(year, month - 1, 1),
        lt: new Date(year, month, 1),
      },
    },
    include: {
      owner: {
        include: {
          documents: {
            where: { type: "STATEMENT", period },
          },
        },
      },
    },
  });

  // Filter to payouts without an existing statement
  const needsStatement = payouts.filter(
    (p) => p.owner.documents.length === 0
  );

  const results: { ownerId: string; ownerName: string; success: boolean; error?: string }[] = [];

  for (const payout of needsStatement) {
    try {
      // Generate PDF
      const { buffer, netPayout, ownerName } = await generateOwnerStatementPdf(
        payout.ownerId,
        payout.landlordId,
        month,
        year
      );

      // Upload to Vercel Blob
      const url = await uploadStatementPdf(buffer, ownerName, period);

      // Create OwnerDocument record
      const monthName = prevDate.toLocaleString("en-US", { month: "long" });
      await db.ownerDocument.create({
        data: {
          ownerId: payout.ownerId,
          name: `Payout Statement — ${monthName} ${year}`,
          url,
          type: "STATEMENT",
          period,
        },
      });

      // Send email if owner has email
      if (payout.owner.email) {
        const landlordUser = await db.user.findUnique({
          where: { id: payout.landlordId },
          select: { companyName: true },
        });

        try {
          await sendOwnerStatement({
            ownerEmail: payout.owner.email,
            ownerName,
            period: `${monthName} ${year}`,
            statementUrl: url,
            companyName: landlordUser?.companyName || "DoorStax",
            netPayout: formatMoney(netPayout),
          });
        } catch (emailErr) {
          console.error(`Email failed for ${ownerName}:`, emailErr);
          // Don't fail the whole process if email fails
        }
      }

      results.push({ ownerId: payout.ownerId, ownerName, success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`Statement generation failed for owner ${payout.ownerId}:`, err);
      results.push({
        ownerId: payout.ownerId,
        ownerName: payout.owner.name,
        success: false,
        error: message,
      });
    }
  }

  return NextResponse.json({
    period,
    totalEligible: needsStatement.length,
    generated: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  });
}

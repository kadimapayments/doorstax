import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generatePayout } from "@/lib/payout-generator";
import { emit } from "@/lib/events/emitter";
import { notify } from "@/lib/notifications";
import { auditLog } from "@/lib/audit";
import { sendPayoutSummaryEmail } from "@/lib/emails/payout-summary";

/**
 * GET /api/cron/generate-payouts
 * Runs on the 2nd of each month at 10 AM UTC.
 * Auto-generates DRAFT payouts for all owners across all PMs.
 * Idempotent — generatePayout() returns null if a payout already exists.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const month = now.getMonth() + 1; // 1-indexed current month
  const year = now.getFullYear();
  const monthName = now.toLocaleString("en-US", { month: "long" });
  const periodLabel = `${monthName} ${year}`;

  // Find all PM users
  const pmUsers = await db.user.findMany({
    where: { role: "PM" },
    select: { id: true, name: true, email: true, companyName: true },
  });

  const results: {
    landlordId: string;
    pmName: string;
    generated: number;
    skipped: number;
    failed: number;
  }[] = [];

  for (const pm of pmUsers) {
    let generated = 0;
    let skipped = 0;
    let failed = 0;

    // Find all owners for this PM
    const owners = await db.owner.findMany({
      where: { landlordId: pm.id },
      include: { properties: { select: { id: true } } },
    });

    const payoutSummary: {
      ownerName: string;
      grossRent: number;
      netPayout: number;
      status: string;
    }[] = [];

    for (const owner of owners) {
      if (owner.properties.length === 0) {
        skipped++;
        continue;
      }

      try {
        const frequency = owner.payoutFrequency || "MONTHLY";

        if (frequency === "SEMI_MONTHLY") {
          for (const half of [1, 2]) {
            const result = await generatePayout(owner, pm.id, month, year, half);
            if (result) {
              generated++;
              payoutSummary.push({
                ownerName: owner.name,
                grossRent: result.grossRent,
                netPayout: result.netPayout,
                status: "DRAFT",
              });
              emit({
                eventType: "payout.generated",
                aggregateType: "OwnerPayout",
                aggregateId: result.id,
                payload: { ownerId: owner.id, grossRent: Number(result.grossRent), netPayout: Number(result.netPayout), half },
                emittedBy: "system",
              }).catch(console.error);
            } else {
              skipped++;
            }
          }
        } else {
          const result = await generatePayout(owner, pm.id, month, year, null);
          if (result) {
            generated++;
            payoutSummary.push({
              ownerName: owner.name,
              grossRent: result.grossRent,
              netPayout: result.netPayout,
              status: "DRAFT",
            });
            emit({
              eventType: "payout.generated",
              aggregateType: "OwnerPayout",
              aggregateId: result.id,
              payload: { ownerId: owner.id, grossRent: Number(result.grossRent), netPayout: Number(result.netPayout) },
              emittedBy: "system",
            }).catch(console.error);
          } else {
            skipped++;
          }
        }
      } catch (err) {
        console.error(`Payout generation failed for owner ${owner.id}:`, err);
        failed++;
      }
    }

    // Notify PM if payouts were generated
    if (generated > 0) {
      await notify({
        userId: pm.id,
        createdById: pm.id,
        type: "PAYOUTS_GENERATED",
        title: "Monthly Payouts Generated",
        message: `${generated} draft payout${generated !== 1 ? "s" : ""} generated for ${periodLabel} — review and approve in Payouts.`,
        severity: "info",
      }).catch((err) => {
        console.error(`Notification failed for PM ${pm.id}:`, err);
      });

      // Send summary email
      if (pm.email) {
        const totalGross = payoutSummary.reduce((s, p) => s + p.grossRent, 0);
        const totalNet = payoutSummary.reduce((s, p) => s + p.netPayout, 0);

        await sendPayoutSummaryEmail({
          pmEmail: pm.email,
          pmName: pm.name || "Property Manager",
          companyName: pm.companyName || "DoorStax",
          period: periodLabel,
          payouts: payoutSummary,
          totalGross,
          totalNet,
          dashboardUrl: `${process.env.NEXTAUTH_URL || "https://sandbox.doorstax.com"}/dashboard/payouts`,
        }).catch((err) => {
          console.error(`Summary email failed for PM ${pm.id}:`, err);
        });
      }
    }

    // Audit log
    auditLog({
      userId: null,
      userName: "System",
      userRole: "SYSTEM",
      action: "CREATE",
      objectType: "Payout",
      description: `Auto-generated ${generated} draft payout(s) for ${periodLabel}`,
      newValue: { month, year, generated, skipped, failed, landlordId: pm.id },
      req,
    }).catch(() => {});

    results.push({
      landlordId: pm.id,
      pmName: pm.name || pm.email || pm.id,
      generated,
      skipped,
      failed,
    });
  }

  const totalGenerated = results.reduce((s, r) => s + r.generated, 0);
  const totalSkipped = results.reduce((s, r) => s + r.skipped, 0);
  const totalFailed = results.reduce((s, r) => s + r.failed, 0);

  return NextResponse.json({
    success: true,
    period: periodLabel,
    totalGenerated,
    totalSkipped,
    totalFailed,
    pmResults: results,
  });
}

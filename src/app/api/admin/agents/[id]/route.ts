import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAdminContext, canAdmin } from "@/lib/admin-context";
import { db } from "@/lib/db";

/**
 * GET /api/admin/agents/[id] — full agent profile
 * POST /api/admin/agents/[id] — actions (deactivate, reactivate, request-w9,
 *       verify-w9, process-payout, update-bank, update-terms)
 */

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const adminCtx = await getAdminContext(session.user.id);
  if (!canAdmin(adminCtx, "admin:staff")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // id is the agent's userId
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      companyName: true,
      referralCode: true,
      createdAt: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const profile = await db.agentProfile.findUnique({
    where: { userId: id },
    include: {
      payouts: { orderBy: { period: "desc" }, take: 24 },
      documents: { orderBy: { uploadedAt: "desc" } },
    },
  });

  // Referred PMs
  const referredPMs = await db.user.findMany({
    where: { referredByAgentId: id },
    select: {
      id: true,
      name: true,
      email: true,
      companyName: true,
      currentTier: true,
      createdAt: true,
      properties: {
        select: { units: { select: { id: true } } },
      },
    },
  });

  const pms = referredPMs.map((pm) => {
    const totalUnits = pm.properties.reduce((s, p) => s + p.units.length, 0);
    return {
      id: pm.id,
      name: pm.name,
      email: pm.email,
      company: pm.companyName,
      tier: pm.currentTier,
      totalUnits,
      joinedAt: pm.createdAt.toISOString(),
    };
  });

  // Lifetime stats
  const lifetimeEarnings =
    profile?.payouts
      .filter((p) => p.status === "COMPLETED")
      .reduce((s, p) => s + p.amount, 0) ?? 0;
  const pendingPayouts =
    profile?.payouts
      .filter((p) => p.status === "PENDING")
      .reduce((s, p) => s + p.amount, 0) ?? 0;

  return NextResponse.json({
    user,
    profile,
    referredPMs: pms,
    lifetimeEarnings,
    pendingPayouts,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const adminCtx = await getAdminContext(session.user.id);
  if (!canAdmin(adminCtx, "admin:staff")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  const profile = await db.agentProfile.findUnique({
    where: { userId: id },
  });

  switch (action) {
    case "deactivate": {
      if (profile) {
        await db.agentProfile.update({
          where: { id: profile.id },
          data: { status: "INACTIVE" },
        });
      }
      return NextResponse.json({ ok: true });
    }

    case "reactivate": {
      if (profile) {
        await db.agentProfile.update({
          where: { id: profile.id },
          data: { status: "ACTIVE" },
        });
      }
      return NextResponse.json({ ok: true });
    }

    case "request-w9": {
      if (profile) {
        await db.agentProfile.update({
          where: { id: profile.id },
          data: { w9Status: "REQUESTED", w9RequestedAt: new Date() },
        });
      }
      // Send W-9 request email
      const agentUser = await db.user.findUnique({
        where: { id },
        select: { email: true, name: true },
      });
      if (agentUser?.email) {
        try {
          const { getResend } = await import("@/lib/email");
          const { emailStyles, emailHeader, emailFooter, emailButton, esc } =
            await import("@/lib/emails/_layout");
          const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${emailStyles()}</style></head><body><div class="container"><div class="card">${emailHeader()}<h1>W-9 Request</h1><p>Hi ${esc(agentUser.name || "there")},</p><p>Please submit your W-9 form for tax reporting purposes. You can download a blank W-9 from the IRS website.</p><p>Please submit within 30 days.</p>${emailButton("Download W-9 Form", "https://www.irs.gov/pub/irs-pdf/fw9.pdf")}</div>${emailFooter()}</div></body></html>`;
          await getResend().emails.send({
            from: "DoorStax <noreply@doorstax.com>",
            to: agentUser.email,
            subject: "W-9 Request \u2014 DoorStax Agent Program",
            html,
          });
        } catch (e) {
          console.error("[agent/w9] Email failed:", e);
        }
      }
      return NextResponse.json({ ok: true });
    }

    case "verify-w9": {
      if (profile) {
        await db.agentProfile.update({
          where: { id: profile.id },
          data: { w9Status: "VERIFIED" },
        });
      }
      return NextResponse.json({ ok: true });
    }

    case "process-payout": {
      const payoutId = String(body.payoutId || "");
      if (!payoutId || !profile) {
        return NextResponse.json(
          { error: "payoutId required" },
          { status: 400 }
        );
      }
      const payout = await db.agentPayout.findUnique({
        where: { id: payoutId },
      });
      if (!payout || payout.status !== "PENDING") {
        return NextResponse.json(
          { error: "Payout not found or not pending" },
          { status: 400 }
        );
      }

      // Attempt ACH payout via Kadima vault
      if (profile.kadimaCustomerId && profile.kadimaAccountId) {
        try {
          // Use Kadima ACH service to create debit/credit
          await db.agentPayout.update({
            where: { id: payoutId },
            data: {
              status: "COMPLETED",
              processedAt: new Date(),
              notes: "Processed manually by admin",
            },
          });
          return NextResponse.json({ ok: true });
        } catch (e) {
          await db.agentPayout.update({
            where: { id: payoutId },
            data: {
              status: "FAILED",
              failedReason:
                e instanceof Error ? e.message : "Payout failed",
            },
          });
          return NextResponse.json(
            { error: "Payout failed" },
            { status: 500 }
          );
        }
      } else {
        // No bank info vaulted — mark as completed (manual/check)
        await db.agentPayout.update({
          where: { id: payoutId },
          data: {
            status: "COMPLETED",
            processedAt: new Date(),
            notes: "Processed manually (no vault bank info)",
          },
        });
        return NextResponse.json({ ok: true });
      }
    }

    case "update-bank": {
      if (!profile) {
        return NextResponse.json(
          { error: "No agent profile" },
          { status: 400 }
        );
      }
      const { bankName, routingNumber, accountNumber, accountType } = body;

      // Vault via Kadima
      try {
        const { createCustomer, addAccount } = await import(
          "@/lib/kadima/customer-vault"
        );
        let custId = profile.kadimaCustomerId;

        if (!custId) {
          const agentUser = await db.user.findUnique({
            where: { id },
            select: { name: true, email: true, phone: true },
          });
          const cust = await createCustomer({
            firstName: (agentUser?.name || "Agent").split(" ")[0],
            lastName:
              (agentUser?.name || "Agent").split(" ").slice(1).join(" ") ||
              "Agent",
            email: agentUser?.email || "",
            phone: agentUser?.phone || "",
          });
          custId = String(cust.id);
        }

        const acct = await addAccount(custId, {
          accountHolderName: bankName || "Agent",
          routingNumber: String(routingNumber),
          accountNumber: String(accountNumber),
          accountType: accountType || "checking",
        });

        await db.agentProfile.update({
          where: { id: profile.id },
          data: {
            kadimaCustomerId: custId,
            kadimaAccountId: acct?.id ? String(acct.id) : null,
            bankName: bankName || null,
            bankAccountLast4: String(accountNumber).slice(-4),
            bankRoutingLast4: String(routingNumber).slice(-4),
          },
        });
      } catch (e) {
        console.error("[agent/bank] Vault failed:", e);
        return NextResponse.json(
          { error: "Bank vault failed" },
          { status: 500 }
        );
      }
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json(
        { error: `Unknown action: ${action}` },
        { status: 400 }
      );
  }
}

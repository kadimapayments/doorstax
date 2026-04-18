import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAdminContext, canAdmin } from "@/lib/admin-context";
import { db } from "@/lib/db";
import { validateCommissionConfig } from "@/lib/agent-commission-config";
import { auditLog } from "@/lib/audit";

/**
 * GET /api/admin/agents/[id] — full agent profile
 * POST /api/admin/agents/[id] — actions (deactivate, reactivate, request-w9,
 *       verify-w9, process-payout, update-bank, update-commission)
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

  // Proposals this agent sent — fetched separately because the relation key
  // is agentUserId on ProposalQuote (not via agentProfile).
  const proposals = await db.proposalQuote.findMany({
    where: { agentUserId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      quoteId: true,
      prospectName: true,
      prospectEmail: true,
      prospectCompany: true,
      unitCount: true,
      softwareCost: true,
      status: true,
      openCount: true,
      sentAt: true,
      clickedAt: true,
      convertedAt: true,
      pdfUrl: true,
    },
  });

  const proposalStats = {
    total: proposals.length,
    opened: proposals.filter((p) => p.openCount > 0).length,
    clicked: proposals.filter((p) => !!p.clickedAt).length,
    converted: proposals.filter((p) => p.status === "CONVERTED").length,
  };

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
    proposals: proposals.map((p) => ({
      ...p,
      sentAt: p.sentAt?.toISOString() ?? null,
      clickedAt: p.clickedAt?.toISOString() ?? null,
      convertedAt: p.convertedAt?.toISOString() ?? null,
    })),
    proposalStats,
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
          const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com";
          const portalUrl = `${BASE_URL}/partner/documents`;
          const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${emailStyles()}</style></head><body><div class="container"><div class="card">${emailHeader()}<h1>W-9 Request</h1><p>Hi ${esc(agentUser.name || "there")},</p><p>We need your W-9 on file before we can issue payouts over $600/year. Please upload it in your DoorStax Partner Portal:</p>${emailButton("Upload W-9 in Partner Portal", portalUrl)}<p style="margin-top:16px;font-size:13px;color:#666;">Need a blank W-9? <a href="https://www.irs.gov/pub/irs-pdf/fw9.pdf" style="color:#5B00FF;">Download from IRS.gov</a>. Once signed, upload the completed form using the button above.</p><p style="font-size:13px;color:#666;">Please submit within 30 days.</p></div>${emailFooter()}</div></body></html>`;
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
      if (!routingNumber || !accountNumber) {
        return NextResponse.json(
          { error: "routingNumber and accountNumber required" },
          { status: 400 }
        );
      }

      try {
        const {
          addAccount,
          createAchCustomerWithAccount,
        } = await import("@/lib/kadima/customer-vault");
        const { formatPhoneE164 } = await import("@/lib/kadima/phone");

        const agentUser = await db.user.findUnique({
          where: { id },
          select: { name: true, email: true, phone: true },
        });
        const displayName = agentUser?.name || "Agent";
        const firstName = displayName.split(" ")[0] || "Agent";
        const lastName = displayName.split(" ").slice(1).join(" ") || firstName;

        let custId = profile.kadimaCustomerId;
        let acctId: string | null = null;

        if (!custId) {
          // No ACH customer yet — create customer + first account in one call.
          // Kadima does not allow empty ACH customers.
          const result = await createAchCustomerWithAccount({
            accountName: bankName || displayName,
            firstName,
            lastName,
            email: agentUser?.email || "",
            phone: formatPhoneE164(agentUser?.phone || undefined) || undefined,
            identificator: `agent-${profile.id}`,
            routingNumber: String(routingNumber),
            accountNumber: String(accountNumber),
            accountType: accountType === "savings" ? "savings" : "checking",
          });
          custId = result.customerId;
          acctId = result.accountId;

          // If the create call didn't surface an accountId, list accounts to find it.
          if (!acctId) {
            try {
              const { listAccounts } = await import(
                "@/lib/kadima/customer-vault"
              );
              const list = await listAccounts(custId);
              const first = list?.items?.[0];
              if (first?.id != null) acctId = String(first.id);
            } catch (lookupErr) {
              console.error("[agent/bank] listAccounts lookup failed:", lookupErr);
            }
          }
        } else {
          // Customer already exists in ACH namespace — just add another account.
          const acct = await addAccount(custId, {
            accountHolderName: bankName || displayName,
            routingNumber: String(routingNumber),
            accountNumber: String(accountNumber),
            accountType: accountType || "checking",
          });
          acctId = acct?.id ? String(acct.id) : null;
        }

        await db.agentProfile.update({
          where: { id: profile.id },
          data: {
            kadimaCustomerId: custId,
            kadimaAccountId: acctId,
            bankName: bankName || null,
            bankAccountLast4: String(accountNumber).slice(-4),
            bankRoutingLast4: String(routingNumber).slice(-4),
          },
        });
      } catch (e) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const err = e as any;
        console.error("[agent/bank] Vault failed:", {
          message: err?.message,
          status: err?.response?.status,
          data: err?.response?.data,
        });
        return NextResponse.json(
          {
            error: "Bank vault failed",
            detail:
              err?.response?.data?.message || err?.message || "Unknown error",
          },
          { status: 500 }
        );
      }
      return NextResponse.json({ ok: true });
    }

    case "update-commission": {
      if (!profile) {
        return NextResponse.json(
          { error: "Agent profile not found" },
          { status: 404 }
        );
      }
      const result = validateCommissionConfig(body);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      const { config } = result;
      const previous = {
        commissionEnabled: profile.commissionEnabled,
        commissionMode: profile.commissionMode,
        customTierRates: profile.customTierRates,
      };
      const updated = await db.agentProfile.update({
        where: { id: profile.id },
        data: {
          commissionEnabled: config.commissionEnabled,
          commissionMode: config.commissionMode,
          customTierRates: config.customTierRates ?? undefined,
        },
        select: {
          commissionEnabled: true,
          commissionMode: true,
          customTierRates: true,
        },
      });
      auditLog({
        userId: session.user.id,
        userName: session.user.name,
        userRole: session.user.role,
        action: "UPDATE",
        objectType: "AgentProfile",
        objectId: profile.id,
        description: `Updated commission config for agent (userId: ${id})`,
        oldValue: previous,
        newValue: updated,
        req,
      });
      return NextResponse.json({ ok: true, commission: updated });
    }

    case "update-profile": {
      // Edit contact info. Split updates across User (name, email) and
      // AgentProfile (phone, company).
      const { name, email, phone, company } = body as {
        name?: string;
        email?: string;
        phone?: string;
        company?: string;
      };

      // Load current values for the audit trail
      const current = await db.user.findUnique({
        where: { id },
        select: { name: true, email: true, phone: true, companyName: true },
      });
      if (!current) {
        return NextResponse.json({ error: "Agent not found" }, { status: 404 });
      }

      // Email uniqueness check if changing
      const newEmail = email ? String(email).toLowerCase().trim() : undefined;
      if (newEmail && newEmail !== current.email.toLowerCase()) {
        const dup = await db.user.findUnique({
          where: { email: newEmail },
          select: { id: true },
        });
        if (dup && dup.id !== id) {
          return NextResponse.json(
            { error: "That email is already in use by another account" },
            { status: 409 }
          );
        }
      }

      const userData: Record<string, unknown> = {};
      if (name !== undefined) userData.name = name || current.name;
      if (newEmail !== undefined) userData.email = newEmail;
      if (phone !== undefined) userData.phone = phone || null;
      if (company !== undefined) userData.companyName = company || null;

      const updated = await db.user.update({
        where: { id },
        data: userData,
        select: { name: true, email: true, phone: true, companyName: true },
      });

      // Keep AgentProfile.phone and .company in sync (they were already redundant with User)
      if (profile && (phone !== undefined || company !== undefined)) {
        await db.agentProfile.update({
          where: { id: profile.id },
          data: {
            ...(phone !== undefined ? { phone: phone || null } : {}),
            ...(company !== undefined ? { company: company || null } : {}),
          },
        });
      }

      auditLog({
        userId: session.user.id,
        userName: session.user.name,
        userRole: session.user.role,
        action: "UPDATE",
        objectType: "Agent",
        objectId: id,
        description: `Updated agent contact info`,
        oldValue: current,
        newValue: updated,
        req,
      });

      return NextResponse.json({ ok: true, user: updated });
    }

    default:
      return NextResponse.json(
        { error: `Unknown action: ${action}` },
        { status: 400 }
      );
  }
}

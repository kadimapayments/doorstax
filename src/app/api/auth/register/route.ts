import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { z } from "zod";
import { checkIp, getClientIp } from "@/lib/ip-check";
import { createKadimaLead } from "@/lib/kadima/lead";
import { createSubscription } from "@/lib/subscription";
import { createDoorstaxCustomer } from "@/lib/kadima/doorstax-billing";
import { verifyToken } from "@/lib/invite-tokens";
import { authLimiter, getClientIp as getRateLimitIp, rateLimitResponse } from "@/lib/rate-limit";
import { welcomePmHtml } from "@/lib/emails/welcome-pm";
import { getResend } from "@/lib/email";

const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().regex(/^\d{10,15}$/, "Valid phone number required"),
  // Self-registration roles: PM (property manager / landlord) and VENDOR.
  // Everyone else (TENANT, OWNER, PARTNER, ADMIN, LANDLORD) is created by
  // an invite flow or the admin panel, never self-serve.
  role: z.enum(["PM", "VENDOR"]).default("PM"),
  companyName: z.string().optional(),
  tosAccepted: z.boolean().optional(),
  inviteToken: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    // ─── Rate Limiting ────────────────────────────────────────
    const rlIp = getRateLimitIp(req);
    const rl = await authLimiter.limit(rlIp);
    if (!rl.success) return rateLimitResponse(rl.reset);

    const body = await req.json();
    const data = registerSchema.parse(body);
    data.email = data.email.toLowerCase().trim();

    // ─── IP Security Check (VPN + Geo) ────────────────────────
    const ipCheck = await checkIp(getClientIp(req));
    if (!ipCheck.allowed) {
      return NextResponse.json(
        { error: ipCheck.message, code: ipCheck.code },
        { status: 403 }
      );
    }

    const existing = await db.user.findFirst({
      where: { email: { equals: data.email, mode: "insensitive" } },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    const passwordHash = await hash(data.password, 12);

    // ─── Validate agent invite token if present ──────
    let validInvite: {
      id: string;
      parentPmId: string;
      perUnitCost: unknown;
      cardRateOverride: unknown;
      achRateOverride: unknown;
      commissionRate: unknown;
      residualSplit: unknown;
    } | null = null;

    if (data.inviteToken) {
      // Find all non-expired, non-accepted invites for this email
      const invites = await db.agentInvite.findMany({
        where: {
          email: data.email,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
      });

      for (const inv of invites) {
        const isValid = await verifyToken(data.inviteToken, inv.tokenHash);
        if (isValid) {
          validInvite = inv;
          break;
        }
      }

      if (!validInvite) {
        return NextResponse.json(
          { error: "Invalid or expired invite token" },
          { status: 400 }
        );
      }
    }

    // Resolve agent referral (if registering via ?ref= link)
    let referredByAgentId: string | null = null;
    const refCode = typeof body.refCode === "string" ? body.refCode.trim() : "";
    if (refCode) {
      const agent = await db.user.findFirst({
        where: { referralCode: refCode },
        select: { id: true },
      });
      if (agent) referredByAgentId = agent.id;
    }

    const user = await db.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        passwordHash,
        role: data.role,
        ...(data.companyName ? { companyName: data.companyName } : {}),
        ...(referredByAgentId ? { referredByAgentId } : {}),
        ...(data.tosAccepted
          ? { tosAcceptedAt: new Date(), privacyAcceptedAt: new Date() }
          : {}),
      },
      select: { id: true },
    });

    // ─── Vendor self-registration short-circuit ─────────────────
    // Vendors don't need a merchant application, Kadima lead, or a
    // subscription. Their onboarding is W-9 + bank at /vendor/documents.
    if (data.role === "VENDOR") {
      // Send a minimal welcome email pointing them at the portal.
      try {
        const { getResend } = await import("@/lib/email");
        const BASE_URL =
          process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com";
        await getResend().emails.send({
          from: "DoorStax <noreply@doorstax.com>",
          to: data.email,
          subject: "Welcome to the DoorStax vendor network",
          html: `<p>Hi ${data.name},</p><p>Your vendor account is ready. To appear in the DoorStax directory and receive service tickets, please upload your W-9 and add a bank account for payouts.</p><p><a href="${BASE_URL}/vendor/documents" style="display:inline-block;background:#5B00FF;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">Complete your profile</a></p>`,
        });
      } catch (emailErr) {
        console.error("[register] Vendor welcome email failed:", emailErr);
      }
      return NextResponse.json({ success: true, role: "VENDOR" }, { status: 201 });
    }

    // If referred by an agent, create the AgentRelationship
    if (referredByAgentId) {
      try {
        // Check if the agent has existing terms to use as defaults
        const existingRel = await db.agentRelationship.findFirst({
          where: { parentPmId: referredByAgentId },
          select: {
            perUnitCost: true,
            cardRateOverride: true,
            achRateOverride: true,
            commissionRate: true,
            residualSplit: true,
          },
        });
        await db.agentRelationship.create({
          data: {
            parentPmId: referredByAgentId,
            agentUserId: user.id,
            perUnitCost: existingRel?.perUnitCost ?? 3,
            cardRateOverride: existingRel?.cardRateOverride ?? null,
            achRateOverride: existingRel?.achRateOverride ?? null,
            commissionRate: existingRel?.commissionRate ?? 0,
            residualSplit: existingRel?.residualSplit ?? 0,
          },
        });
      } catch (e) {
        console.error("[register] Agent relationship create failed:", e);
      }
    }

    // Send welcome email to new PM
    try {
      const resend = getResend();
      await resend.emails.send({
        from: "DoorStax <noreply@doorstax.com>",
        to: data.email,
        subject: "Welcome to DoorStax — Let's Get Started",
        html: welcomePmHtml({ pmName: data.name || "there" }),
      });
    } catch (emailErr) {
      console.error("[register] Welcome email failed:", emailErr);
      // Non-blocking
    }

    // ─── Create agent relationship if invite is valid ──
    if (validInvite) {
      await db.agentRelationship.create({
        data: {
          parentPmId: validInvite.parentPmId,
          agentUserId: user.id,
          perUnitCost: validInvite.perUnitCost as number,
          cardRateOverride: validInvite.cardRateOverride as number | null,
          achRateOverride: validInvite.achRateOverride as number | null,
          commissionRate: validInvite.commissionRate as number,
          residualSplit: validInvite.residualSplit as number,
        },
      });

      // Mark invite as accepted
      await db.agentInvite.update({
        where: { id: validInvite.id },
        data: { acceptedAt: new Date() },
      });
    }

    // Create Kadima lead (non-blocking — app record created regardless)
    const lead = await createKadimaLead({
      name: data.name,
      email: data.email,
    }).catch(() => null);

    // Fetch the Kadima hosted completion URL so the PM can finish the
    // application via Kadima's web form. Non-blocking — we fall back to
    // null if the endpoint fails.
    let kadimaApplicationUrl: string | null = null;
    if (lead?.appId) {
      try {
        const { getKadimaBoardingUrl } = await import("@/lib/kadima/lead");
        kadimaApplicationUrl = await getKadimaBoardingUrl(lead.appId);
      } catch (err) {
        console.error("[register] Failed to fetch boarding URL:", err);
      }
    }

    // Always create MerchantApplication so dashboard/onboarding sync works
    // even if Kadima lead creation failed
    const merchantApp = await db.merchantApplication
      .create({
        data: {
          userId: user.id,
          kadimaAppId: lead ? String(lead.appId) : null,
          kadimaApplicationUrl,
          status: "NOT_STARTED",
        },
      })
      .catch(() => null);

    // Email the PM the branded "Continue Your Merchant Application" link
    // so they can complete onboarding via Kadima's web form. Non-blocking.
    if (merchantApp && kadimaApplicationUrl) {
      try {
        const { getResend } = await import("@/lib/email");
        const { merchantApplicationContinueEmail } = await import(
          "@/lib/emails/merchant-application-continue"
        );
        await getResend().emails.send({
          from: "DoorStax <noreply@doorstax.com>",
          to: data.email,
          subject: "Continue Your Merchant Application \u2014 DoorStax",
          html: merchantApplicationContinueEmail({
            pmName: data.name,
            applicationUrl: kadimaApplicationUrl,
            stepsCompleted: "Account creation",
            stepsRemaining:
              "Business info, principal details, processing info, bank information, document upload, and e-signature",
          }),
        });
      } catch (err) {
        console.error("[register] Continue-application email failed:", err);
      }
    }

    // Auto-start 14-day trial subscription
    await createSubscription(user.id).catch((err) => {
      console.error("[register] Failed to create trial subscription:", err);
    });

    // Create DoorStax vault customer for platform billing ($150+/mo software fee)
    createDoorstaxCustomer(user.id, {
      name: data.name,
      email: data.email,
      phone: data.phone,
    }).catch((err) => {
      console.error("[register] Failed to create DoorStax vault customer:", err);
    });

    // Check if this user was a proposal prospect — conversion tracking
    try {
      const proposal = await db.proposalQuote.findFirst({
        where: {
          prospectEmail: data.email.toLowerCase(),
          status: { in: ["SENT", "OPENED", "CLICKED"] },
        },
        orderBy: { createdAt: "desc" },
      });
      if (proposal) {
        await db.proposalQuote.update({
          where: { id: proposal.id },
          data: {
            status: "CONVERTED",
            convertedAt: new Date(),
            convertedPmId: user.id,
          },
        });

        // Also update the linked lead if one exists
        if (proposal.leadId) {
          await db.lead.update({
            where: { id: proposal.leadId },
            data: {
              status: "CONVERTED",
              convertedAt: new Date(),
              convertedPmId: user.id,
            },
          }).catch(() => {});
        } else {
          // Try to find a lead by email and update it
          const matchingLead = await db.lead.findFirst({
            where: { email: { equals: data.email, mode: "insensitive" } },
          });
          if (matchingLead) {
            await db.lead.update({
              where: { id: matchingLead.id },
              data: {
                status: "CONVERTED",
                convertedAt: new Date(),
                convertedPmId: user.id,
              },
            }).catch(() => {});
          }
        }

        // Notify the agent
        if (proposal.agentUserId) {
          const { notify } = await import("@/lib/notifications");
          await notify({
            userId: proposal.agentUserId,
            createdById: user.id,
            type: "PROPOSAL_CONVERTED",
            title: "Prospect Converted!",
            message: `${proposal.prospectName} just signed up from your proposal (Quote #${proposal.quoteId})`,
            severity: "info",
            actionUrl: "/admin/proposals",
          }).catch(console.error);
        }
      }
    } catch {}

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

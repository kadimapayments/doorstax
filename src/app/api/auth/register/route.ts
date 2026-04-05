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

const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().regex(/^\d{10,15}$/, "Valid phone number required"),
  role: z.enum(["PM"]), // Only landlord self-registration
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

    const user = await db.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        passwordHash,
        role: data.role,
        ...(data.tosAccepted
          ? { tosAcceptedAt: new Date(), privacyAcceptedAt: new Date() }
          : {}),
      },
      select: { id: true },
    });

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

    // Always create MerchantApplication so dashboard/onboarding sync works
    // even if Kadima lead creation failed
    await db.merchantApplication
      .create({
        data: {
          userId: user.id,
          kadimaAppId: lead ? String(lead.appId) : null,
          status: "NOT_STARTED",
        },
      })
      .catch(() => {
        // MerchantApplication create failed — non-blocking, skip silently
      });

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

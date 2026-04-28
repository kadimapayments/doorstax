import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveTenantUserId } from "@/lib/impersonation";

/**
 * /api/tenant/payment-methods
 *
 * Single source of truth for the new tenant Payment Methods page at
 * /tenant/payment-methods. Replaces the scattered surfaces (settings
 * page card section + inline ACH form on /pay) with one canonical
 * endpoint that lists everything saved on the tenant.
 *
 * GET — return both card and bank state in one response so the page
 *       renders without two round-trips.
 * PATCH — set the tenant's default payment method
 *       ({ defaultMethod: "card" | "ach" }), drives `paymentMethodType`
 *       which the /pay page reads for the pre-selected tab.
 *
 * Add / remove actions live on per-method sub-routes (`/card`, `/bank`)
 * because each has different payload + Kadima-side cleanup semantics.
 */

async function loadProfile(session: { user: { id: string; role: string } }) {
  const effectiveUserId = await getEffectiveTenantUserId(session as never);
  if (!effectiveUserId) return null;
  return db.tenantProfile.findUnique({
    where: { userId: effectiveUserId },
    select: {
      id: true,
      // Card-vault fields (Kadima Customer Vault — POST /customer-vault).
      kadimaCustomerId: true,
      kadimaCardTokenId: true,
      cardBrand: true,
      cardLast4: true,
      // ACH-vault fields (Kadima ACH — POST /ach/customer; separate
      // namespace from card vault, see kadimaAchCustomerId comment in
      // schema.prisma).
      kadimaAchCustomerId: true,
      kadimaAccountId: true,
      bankLast4: true,
      bankAccountType: true,
      // Drives which tab is pre-selected on /pay.
      paymentMethodType: true,
    },
  });
}

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "TENANT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await loadProfile(session);
  if (!profile) {
    return NextResponse.json(
      { error: "Tenant profile not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    card:
      profile.kadimaCardTokenId && profile.cardLast4
        ? {
            brand: profile.cardBrand,
            last4: profile.cardLast4,
          }
        : null,
    bank:
      profile.kadimaAccountId && profile.bankLast4
        ? {
            last4: profile.bankLast4,
            accountType: profile.bankAccountType,
            // Surface whether the ACH customer id was actually
            // populated. Tenants who saved a bank pre-fix have
            // kadimaAccountId set but no kadimaAchCustomerId — they
            // can't actually pay via ACH and need to re-add their
            // bank. The UI uses this flag to show a "needs re-link"
            // warning instead of a healthy "saved" badge.
            needsRelink: !profile.kadimaAchCustomerId,
          }
        : null,
    defaultMethod: profile.paymentMethodType, // "card" | "ach" | null
  });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "TENANT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const defaultMethod = body?.defaultMethod;
  if (defaultMethod !== "card" && defaultMethod !== "ach") {
    return NextResponse.json(
      { error: "defaultMethod must be 'card' or 'ach'" },
      { status: 400 }
    );
  }

  const profile = await loadProfile(session);
  if (!profile) {
    return NextResponse.json(
      { error: "Tenant profile not found" },
      { status: 404 }
    );
  }

  // Don't let a tenant set a default they don't actually have on file.
  // Avoids `/pay` pre-selecting a tab with no underlying method,
  // which would render an empty/broken charge button.
  if (defaultMethod === "card" && !profile.kadimaCardTokenId) {
    return NextResponse.json(
      { error: "No card on file. Add a card before setting it as default." },
      { status: 400 }
    );
  }
  if (defaultMethod === "ach" && !profile.kadimaAccountId) {
    return NextResponse.json(
      { error: "No bank account on file. Add a bank before setting it as default." },
      { status: 400 }
    );
  }

  await db.tenantProfile.update({
    where: { id: profile.id },
    data: { paymentMethodType: defaultMethod },
  });

  return NextResponse.json({ ok: true, defaultMethod });
}

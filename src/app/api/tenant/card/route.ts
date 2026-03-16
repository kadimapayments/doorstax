import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveTenantUserId } from "@/lib/impersonation";
import { deleteCard } from "@/lib/kadima/customer-vault";
import { provisionVaultCustomer } from "@/lib/kadima/provision-vault-customer";

/**
 * Helper: get the tenant profile for the effective (possibly impersonated) user.
 */
async function getTenantProfile(session: { user: { id: string; role: string } }) {
  const effectiveUserId = await getEffectiveTenantUserId(session as any);
  if (!effectiveUserId) return null;

  return db.tenantProfile.findUnique({
    where: { userId: effectiveUserId },
    select: {
      id: true,
      kadimaCustomerId: true,
      kadimaBillingId: true,
      kadimaCardTokenId: true,
      cardBrand: true,
      cardLast4: true,
      autopayEnabled: true,
      user: { select: { name: true, email: true, phone: true } },
    },
  });
}

/**
 * GET /api/tenant/card — Get tenant's saved card info
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const profile = await getTenantProfile(session);
    if (!profile) {
      return NextResponse.json({ error: "Tenant profile not found" }, { status: 404 });
    }

    return NextResponse.json({
      hasCard: !!profile.kadimaCardTokenId,
      cardBrand: profile.cardBrand,
      cardLast4: profile.cardLast4,
      customerId: profile.kadimaCustomerId,
    });
  } catch (error) {
    console.error("GET /api/tenant/card error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * PUT /api/tenant/card — Provision a Kadima vault customer (if needed).
 * Returns the customerId to use with hosted fields.
 */
export async function PUT() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const profile = await getTenantProfile(session);
    if (!profile) {
      return NextResponse.json({ error: "Tenant profile not found" }, { status: 404 });
    }

    // If already has a customerId, return it
    if (profile.kadimaCustomerId) {
      return NextResponse.json({
        customerId: profile.kadimaCustomerId,
        billingId: profile.kadimaBillingId,
      });
    }

    // Provision now (creates customer + billing info)
    const nameParts = (profile.user.name || "").split(" ");
    const result = await provisionVaultCustomer({
      tenantProfileId: profile.id,
      firstName: nameParts[0] || "Tenant",
      lastName: nameParts.slice(1).join(" ") || "",
      email: profile.user.email || "",
      phone: profile.user.phone || undefined,
    });

    if (!result.customerId) {
      return NextResponse.json(
        { error: "Failed to create Kadima customer" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      customerId: result.customerId,
      billingId: result.billingId,
    });
  } catch (error) {
    console.error("PUT /api/tenant/card error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * POST /api/tenant/card — DEPRECATED
 *
 * Card saves now use the Kadima Customer Vault Hosted Card Form (redirect flow).
 * Use POST /api/payments/vault-card-form to get the redirect URL instead.
 *
 * The old hosted-fields token approach cannot vault cards — Kadima's
 * POST /customer-vault/:id/card requires raw card data, not tokens.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "This endpoint is deprecated. Use POST /api/payments/vault-card-form to save cards via the Kadima hosted card form.",
    },
    { status: 410 }
  );
}

/**
 * DELETE /api/tenant/card — Remove tenant's card on file
 * Also disables autopay if active.
 */
export async function DELETE() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const profile = await getTenantProfile(session);
    if (!profile) {
      return NextResponse.json({ error: "Tenant profile not found" }, { status: 404 });
    }

    // Try to delete from Kadima vault if IDs exist
    if (profile.kadimaCustomerId && profile.kadimaCardTokenId) {
      try {
        await deleteCard(profile.kadimaCustomerId, profile.kadimaCardTokenId);
      } catch {
        // If remote deletion fails, still clear local record
        console.warn("Failed to delete card from Kadima vault");
      }
    }

    // Clear local record + disable autopay
    await db.tenantProfile.update({
      where: { id: profile.id },
      data: {
        kadimaCardTokenId: null,
        cardBrand: null,
        cardLast4: null,
        autopayEnabled: false,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/tenant/card error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

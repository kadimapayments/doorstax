import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveTenantUserId } from "@/lib/impersonation";
import { createCustomer, addCard, deleteCard } from "@/lib/kadima/customer-vault";

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
 * PUT /api/tenant/card — Create a Kadima customer for the tenant (if needed)
 * Returns the customerId to use with hosted fields
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
      return NextResponse.json({ customerId: profile.kadimaCustomerId });
    }

    // Create a new Kadima customer
    const nameParts = (profile.user.name || "").split(" ");
    const firstName = nameParts[0] || "Tenant";
    const lastName = nameParts.slice(1).join(" ") || "User";

    const result = await createCustomer({
      firstName,
      lastName,
      email: profile.user.email,
      phone: profile.user.phone || undefined,
    });

    const newCustomerId = (result as unknown as Record<string, any>).data?.id;
    if (!newCustomerId) {
      return NextResponse.json(
        { error: "Failed to create Kadima customer" },
        { status: 500 }
      );
    }

    // Save the customerId
    await db.tenantProfile.update({
      where: { id: profile.id },
      data: { kadimaCustomerId: newCustomerId },
    });

    return NextResponse.json({ customerId: newCustomerId });
  } catch (error) {
    console.error("PUT /api/tenant/card error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * POST /api/tenant/card — Save card after hosted fields completion.
 * Creates a vault customer if needed, then adds the card using the hosted fields token.
 * Body: { cardToken, cardBrand, cardLast4 }
 *
 * Matches the pattern in /api/tenant/onboarding/payment-method
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const profile = await getTenantProfile(session);
    if (!profile) {
      return NextResponse.json({ error: "Tenant profile not found" }, { status: 404 });
    }

    const body = await req.json();
    const { cardToken, cardBrand, cardLast4 } = body;

    if (!cardToken) {
      return NextResponse.json(
        { error: "cardToken is required" },
        { status: 400 }
      );
    }

    console.log("[tenant/card POST] Saving card:", { cardToken: cardToken?.substring(0, 20) + "...", cardBrand, cardLast4, profileId: profile.id, existingCustomerId: profile.kadimaCustomerId });

    // 1. Create vault customer if not exists
    let customerId = profile.kadimaCustomerId;

    if (!customerId) {
      const nameParts = (profile.user.name || "").split(" ");
      const firstName = nameParts[0] || "Tenant";
      const lastName = nameParts.slice(1).join(" ") || "";

      try {
        const customerRes = await createCustomer({
          firstName,
          lastName,
          email: profile.user.email || "",
        });
        console.log("[tenant/card POST] createCustomer result:", JSON.stringify(customerRes));
        customerId = customerRes.data?.id ?? null;
      } catch (custErr: any) {
        console.error("[tenant/card POST] createCustomer error:", {
          message: custErr?.message,
          status: custErr?.response?.status,
          data: JSON.stringify(custErr?.response?.data),
        });
        throw custErr;
      }
    }

    if (!customerId) {
      return NextResponse.json(
        { error: "Failed to create payment vault" },
        { status: 500 }
      );
    }

    // 2. Add card to vault using the hosted fields token
    try {
      console.log("[tenant/card POST] Adding card to vault, customerId:", customerId, "token:", cardToken?.substring(0, 20) + "...");
      const cardRes = await addCard(customerId, {
        token: cardToken,
      } as any);
      console.log("[tenant/card POST] addCard result:", JSON.stringify(cardRes));
      const cardTokenId = cardRes.data?.id;

      // 3. Update tenant profile with vault IDs + display info
      await db.tenantProfile.update({
        where: { id: profile.id },
        data: {
          kadimaCustomerId: customerId,
          kadimaCardTokenId: cardTokenId || cardToken,
          cardBrand: cardBrand || null,
          cardLast4: cardLast4 || null,
        },
      });

      return NextResponse.json({ success: true, customerId, cardTokenId });
    } catch (cardErr: any) {
      console.error("[tenant/card POST] addCard error:", {
        message: cardErr?.message,
        status: cardErr?.response?.status,
        data: JSON.stringify(cardErr?.response?.data),
      });

      // Fallback: if addCard fails, save the hosted-fields token directly
      // The token from /hosted-fields/card-token can be used for future charges
      console.log("[tenant/card POST] Falling back to saving token directly without vault");
      await db.tenantProfile.update({
        where: { id: profile.id },
        data: {
          kadimaCustomerId: customerId,
          kadimaCardTokenId: cardToken,
          cardBrand: cardBrand || null,
          cardLast4: cardLast4 || null,
        },
      });

      return NextResponse.json({ success: true, customerId, cardTokenId: cardToken, fallback: true });
    }
  } catch (error: any) {
    console.error("POST /api/tenant/card error:", {
      message: error?.message,
      status: error?.response?.status,
      data: JSON.stringify(error?.response?.data),
    });
    return NextResponse.json({ error: "Failed to save payment method" }, { status: 500 });
  }
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

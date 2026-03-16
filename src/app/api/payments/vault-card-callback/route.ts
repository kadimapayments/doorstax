import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { listCards } from "@/lib/kadima/customer-vault";

/**
 * GET /api/payments/vault-card-callback
 *
 * Called after the Kadima Vault Hosted Card Form redirects back.
 * Checks the vault for newly added cards and updates the tenant profile.
 * Then redirects the user back to their original page.
 *
 * Query params:
 *   - redirect: The page to redirect to after processing (e.g., /tenant-onboarding, /tenant/pay)
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { searchParams } = new URL(req.url);
  const redirectTo = searchParams.get("redirect") || "/tenant";

  try {
    // Determine vault customer ID based on role
    let kadimaCustomerId: string | null = null;
    let profileId: string | null = null;
    const isPM = session.user.role === "PM" || session.user.role === "ADMIN";

    if (isPM) {
      const user = await db.user.findUnique({
        where: { id: session.user.id },
        select: { kadimaCustomerId: true },
      });
      kadimaCustomerId = user?.kadimaCustomerId || null;
    } else {
      const profile = await db.tenantProfile.findUnique({
        where: { userId: session.user.id },
        select: {
          id: true,
          kadimaCustomerId: true,
        },
      });
      kadimaCustomerId = profile?.kadimaCustomerId || null;
      profileId = profile?.id || null;
    }

    if (!kadimaCustomerId) {
      console.error("[vault-card-callback] No vault customer ID for user", session.user.id);
      return NextResponse.redirect(new URL(`${redirectTo}?cardError=no-customer`, req.url));
    }

    // Fetch cards from vault to find the newly added card
    const cardsResponse = await listCards(kadimaCustomerId);
    const cards = cardsResponse?.items || [];

    console.log("[vault-card-callback] Cards in vault:", JSON.stringify(cards, null, 2));

    if (cards.length > 0) {
      // Use the most recently added card (highest ID)
      const latestCard = cards.reduce((a: any, b: any) =>
        (Number(b.id) > Number(a.id)) ? b : a
      );

      console.log("[vault-card-callback] Latest card object:", JSON.stringify(latestCard, null, 2));

      const cardId = String(latestCard.id);

      // Extract last 4 digits — prefer lastFour field, fall back to parsing number
      const number = latestCard.number || "";
      const last4 =
        latestCard.lastFour ||
        (number.replace(/\D/g, "").slice(-4) || null);

      // Detect card brand — prefer bin.brand from Kadima, fall back to first-digit heuristic
      let cardBrand: string | null = null;
      if (latestCard.bin?.brand) {
        cardBrand = latestCard.bin.brand.toLowerCase();
      } else {
        const firstDigit = number.replace(/\D/g, "").charAt(0);
        if (firstDigit === "4") cardBrand = "visa";
        else if (firstDigit === "5") cardBrand = "mastercard";
        else if (firstDigit === "3") cardBrand = "amex";
        else if (firstDigit === "6") cardBrand = "discover";
      }

      if (isPM) {
        // Update PM user record
        await db.user.update({
          where: { id: session.user.id },
          data: {
            kadimaCardTokenId: cardId,
            pmCardBrand: cardBrand,
            pmCardLast4: last4,
          },
        });
      } else {
        // Update tenant profile
        await db.tenantProfile.update({
          where: { id: profileId! },
          data: {
            kadimaCardTokenId: cardId,
            cardBrand,
            cardLast4: last4,
            paymentMethodType: "card",
          },
        });
      }

      console.log("[vault-card-callback] Saved card", cardId, "last4:", last4, "brand:", cardBrand, "role:", session.user.role);

      return NextResponse.redirect(new URL(`${redirectTo}?cardSaved=true`, req.url));
    } else {
      console.warn("[vault-card-callback] No cards found in vault after form completion");
      return NextResponse.redirect(new URL(`${redirectTo}?cardError=no-card`, req.url));
    }
  } catch (error: any) {
    console.error("[vault-card-callback] Error:", {
      message: error?.message,
      status: error?.response?.status,
      data: JSON.stringify(error?.response?.data),
    });
    return NextResponse.redirect(new URL(`${redirectTo}?cardError=failed`, req.url));
  }
}

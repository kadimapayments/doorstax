import { db } from "@/lib/db";
import { getMerchantCredentialsForTenant } from "./merchant-context";
import { merchantListCards } from "./merchant-vault";
import type { CustomerCard } from "./types";

export interface SyncTenantCardResult {
  found: boolean;
  cardId?: string;
  customerId?: string;
  brand?: string | null;
  last4?: string | null;
  /** True if this call wrote new card data to the TenantProfile (vs. it was already in sync). */
  updated: boolean;
}

/**
 * Pull the tenant's card from the PM's merchant-scoped Kadima vault and persist
 * it to the TenantProfile. Used both by the embedded-iframe polling endpoint and
 * by the full-redirect callback path — keeping both on the same logic guarantees
 * they can't drift apart.
 *
 * Returns `{ found: false }` when the vault has no cards (still polling) or when
 * the tenant has no `kadimaCustomerId` provisioned yet. Throws only on hard
 * infrastructure failures; expected "no card yet" outcomes resolve normally.
 */
export async function syncTenantCardFromVault(
  tenantProfileId: string
): Promise<SyncTenantCardResult> {
  const profile = await db.tenantProfile.findUnique({
    where: { id: tenantProfileId },
    select: {
      id: true,
      kadimaCustomerId: true,
      kadimaCardTokenId: true,
    },
  });

  if (!profile?.kadimaCustomerId) {
    return { found: false, updated: false };
  }

  const creds = await getMerchantCredentialsForTenant(profile.id);
  const cardsResponse = await merchantListCards(creds, profile.kadimaCustomerId);
  const cards: CustomerCard[] = cardsResponse?.items || [];

  if (cards.length === 0) {
    return { found: false, customerId: profile.kadimaCustomerId, updated: false };
  }

  // Pick the most recently added card (highest numeric ID).
  const latestCard = cards.reduce((a, b) =>
    Number(b.id) > Number(a.id) ? b : a
  );

  const cardId = String(latestCard.id);
  const cardToken = latestCard.token ? String(latestCard.token) : null;

  // Last 4: prefer the explicit field, fall back to the masked number.
  const number = String(latestCard.number || "");
  const last4 =
    latestCard.lastFour || number.replace(/\D/g, "").slice(-4) || null;

  // Brand: prefer Kadima's bin.brand, fall back to first-digit heuristic.
  let brand: string | null = null;
  if (latestCard.bin?.brand) {
    brand = String(latestCard.bin.brand).toLowerCase();
  } else {
    const firstDigit = number.replace(/\D/g, "").charAt(0);
    if (firstDigit === "4") brand = "visa";
    else if (firstDigit === "5") brand = "mastercard";
    else if (firstDigit === "3") brand = "amex";
    else if (firstDigit === "6") brand = "discover";
  }

  const tokenToStore = cardToken || cardId;
  const alreadyInSync = profile.kadimaCardTokenId === tokenToStore;

  if (!alreadyInSync) {
    await db.tenantProfile.update({
      where: { id: profile.id },
      data: {
        kadimaCardTokenId: tokenToStore,
        cardBrand: brand,
        cardLast4: last4,
        paymentMethodType: "card",
      },
    });
  }

  return {
    found: true,
    cardId,
    customerId: profile.kadimaCustomerId,
    brand,
    last4,
    updated: !alreadyInSync,
  };
}

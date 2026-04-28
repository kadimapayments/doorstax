import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveTenantUserId } from "@/lib/impersonation";
import { deleteCard } from "@/lib/kadima/customer-vault";

/**
 * /api/tenant/payment-methods/card
 *
 * DELETE — remove the saved card. Mirrors the bank DELETE shape:
 *   - Best-effort Kadima `deleteCard` (continues even if Kadima 404s
 *     because the token's already gone).
 *   - Clears the local DB fields.
 *   - If `paymentMethodType` was "card", flips it to null so /pay
 *     doesn't auto-select a tab with no method backing it.
 *
 * No POST here — adding a card requires the Kadima hosted form flow
 * (PCI scope), which is already wired through
 * /api/payments/vault-card-form. The Payment Methods page calls that
 * endpoint directly to get a redirect URL.
 */

export async function DELETE() {
  const session = await auth();
  if (!session?.user || session.user.role !== "TENANT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const effectiveUserId = await getEffectiveTenantUserId(session as never);
  if (!effectiveUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await db.tenantProfile.findUnique({
    where: { userId: effectiveUserId },
    select: {
      id: true,
      kadimaCustomerId: true,
      kadimaCardTokenId: true,
      paymentMethodType: true,
    },
  });

  if (!profile) {
    return NextResponse.json(
      { error: "Tenant profile not found" },
      { status: 404 }
    );
  }

  if (!profile.kadimaCardTokenId) {
    return NextResponse.json({ error: "No card on file" }, { status: 404 });
  }

  if (profile.kadimaCustomerId) {
    try {
      await deleteCard(profile.kadimaCustomerId, profile.kadimaCardTokenId);
    } catch (cleanupErr) {
      console.warn(
        "[payment-methods/card] Kadima delete failed (continuing to clear local):",
        cleanupErr
      );
    }
  }

  await db.tenantProfile.update({
    where: { id: profile.id },
    data: {
      kadimaCardTokenId: null,
      cardBrand: null,
      cardLast4: null,
      ...(profile.paymentMethodType === "card" && { paymentMethodType: null }),
    },
  });

  return NextResponse.json({ ok: true });
}

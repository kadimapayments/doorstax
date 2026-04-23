import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncTenantCardFromVault } from "@/lib/kadima/sync-tenant-card";

/**
 * GET /api/payments/vault-card-status
 *
 * Polled by the embedded Kadima card-vault iframe modal to detect when a
 * tenant has saved a card. Runs same-origin from the parent page (so the
 * NextAuth session cookie is always present), reads the card from the PM's
 * merchant-scoped vault, and persists it to the TenantProfile.
 *
 * This intentionally does the persistence work itself rather than relying on
 * the cross-origin iframe → /vault-card-callback round-trip, which strips
 * SameSite=Lax cookies and lands the iframe on /login.
 *
 * Returns { hasCard, cardBrand, cardLast4 }. `hasCard` flips to true on the
 * first poll after the card lands in the vault.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // This endpoint is tenant-only — PMs/Admins use a different flow for vault.
  if (session.user.role !== "TENANT") {
    return NextResponse.json(
      { error: "Tenant context required" },
      { status: 403 }
    );
  }

  const profile = await db.tenantProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  try {
    const result = await syncTenantCardFromVault(profile.id);
    return NextResponse.json({
      hasCard: result.found,
      cardBrand: result.brand ?? null,
      cardLast4: result.last4 ?? null,
      customerId: result.customerId ?? null,
      cardId: result.cardId ?? null,
    });
  } catch (error: unknown) {
    const err = error as { message?: string; response?: { status?: number; data?: unknown } };
    console.error("[vault-card-status] Error:", {
      message: err?.message,
      status: err?.response?.status,
      data: JSON.stringify(err?.response?.data),
    });
    // Return hasCard=false rather than 500 so the modal's polling loop keeps
    // running. A transient Kadima blip shouldn't kill the user's flow.
    return NextResponse.json({
      hasCard: false,
      cardBrand: null,
      cardLast4: null,
      customerId: null,
      cardId: null,
    });
  }
}

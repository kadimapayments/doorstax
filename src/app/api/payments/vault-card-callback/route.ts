import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { listCards } from "@/lib/kadima/customer-vault";
import { syncTenantCardFromVault } from "@/lib/kadima/sync-tenant-card";

/**
 * GET /api/payments/vault-card-callback
 *
 * Two modes:
 *
 * 1. **Embedded** (`?embedded=true`): the iframe lands here after Kadima's
 *    hosted card form completes. We do NOT call auth() here — the iframe
 *    navigation is treated as cross-site by the browser, so SameSite=Lax
 *    session cookies are stripped and auth() would always fail (which is
 *    what was bouncing the iframe to /login). Instead we just emit a
 *    postMessage telling the parent the form is done. The parent (which has
 *    full auth) calls /api/payments/vault-card-status to do the real work.
 *
 * 2. **Full redirect** (no `embedded` flag): used by non-iframe entry points
 *    (e.g. /tenant/pay). Auth is required; for tenants we use the merchant-
 *    scoped vault lookup via syncTenantCardFromVault. For PMs/Admins we keep
 *    the global listCards path.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const redirectTo = searchParams.get("redirect") || "/tenant";
  const isEmbedded = searchParams.get("embedded") === "true";

  // ── Embedded: cookie-free wake-up signal to the parent window ──
  if (isEmbedded) {
    const html = `<!DOCTYPE html><html><body><script>
      window.parent.postMessage({ type: 'kadima-card-form-completed' }, '*');
    </script></body></html>`;
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html" },
    });
  }

  // ── Full redirect: auth + persist + redirect back to app ──
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const isPM = session.user.role === "PM" || session.user.role === "ADMIN";

    if (isPM) {
      // PMs/Admins use platform-scoped vault.
      const user = await db.user.findUnique({
        where: { id: session.user.id },
        select: { kadimaCustomerId: true },
      });
      const kadimaCustomerId = user?.kadimaCustomerId || null;

      if (!kadimaCustomerId) {
        console.error("[vault-card-callback] No vault customer ID for PM", session.user.id);
        return NextResponse.redirect(new URL(`${redirectTo}?cardError=no-customer`, req.url));
      }

      const cardsResponse = await listCards(kadimaCustomerId);
      const cards = cardsResponse?.items || [];

      if (cards.length === 0) {
        console.warn("[vault-card-callback] No cards found in PM vault after form completion");
        return NextResponse.redirect(new URL(`${redirectTo}?cardError=no-card`, req.url));
      }

      const latestCard = cards.reduce((a, b) =>
        Number(b.id) > Number(a.id) ? b : a
      );
      const cardId = String(latestCard.id);
      const cardToken = latestCard.token ? String(latestCard.token) : null;
      const number = String(latestCard.number || "");
      const last4 =
        latestCard.lastFour || number.replace(/\D/g, "").slice(-4) || null;
      let cardBrand: string | null = null;
      if (latestCard.bin?.brand) {
        cardBrand = String(latestCard.bin.brand).toLowerCase();
      } else {
        const firstDigit = number.replace(/\D/g, "").charAt(0);
        if (firstDigit === "4") cardBrand = "visa";
        else if (firstDigit === "5") cardBrand = "mastercard";
        else if (firstDigit === "3") cardBrand = "amex";
        else if (firstDigit === "6") cardBrand = "discover";
      }

      await db.user.update({
        where: { id: session.user.id },
        data: {
          kadimaCardTokenId: cardToken || cardId,
          pmCardBrand: cardBrand,
          pmCardLast4: last4,
        },
      });

      return NextResponse.redirect(new URL(`${redirectTo}?cardSaved=true`, req.url));
    }

    // Tenant: merchant-scoped sync
    const profile = await db.tenantProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!profile) {
      return NextResponse.redirect(new URL(`${redirectTo}?cardError=no-customer`, req.url));
    }

    const result = await syncTenantCardFromVault(profile.id);
    if (!result.found) {
      console.warn("[vault-card-callback] No cards found in tenant vault after form completion");
      return NextResponse.redirect(new URL(`${redirectTo}?cardError=no-card`, req.url));
    }

    return NextResponse.redirect(new URL(`${redirectTo}?cardSaved=true`, req.url));
  } catch (error: unknown) {
    const err = error as { message?: string; response?: { status?: number; data?: unknown } };
    console.error("[vault-card-callback] Error:", {
      message: err?.message,
      status: err?.response?.status,
      data: JSON.stringify(err?.response?.data),
    });
    return NextResponse.redirect(new URL(`${redirectTo}?cardError=failed`, req.url));
  }
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveTenantUserId } from "@/lib/impersonation";
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
      user: { select: { name: true, email: true, phone: true } },
    },
  });
}

/**
 * GET /api/tenant/vault-status — Check if tenant has a Kadima vault customer
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
      hasVaultCustomer: !!profile.kadimaCustomerId,
      customerId: profile.kadimaCustomerId,
      billingId: profile.kadimaBillingId,
    });
  } catch (error) {
    console.error("GET /api/tenant/vault-status error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * POST /api/tenant/vault-status — Create a Kadima vault customer if missing.
 * Also creates billing info (required for card operations).
 * Returns the customerId, billingId, and whether it was newly created.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const profile = await getTenantProfile(session);
    if (!profile) {
      return NextResponse.json({ error: "Tenant profile not found" }, { status: 404 });
    }

    // Already provisioned (with billing)
    if (profile.kadimaCustomerId && profile.kadimaBillingId) {
      return NextResponse.json({
        customerId: profile.kadimaCustomerId,
        billingId: profile.kadimaBillingId,
        created: false,
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
        { error: "Failed to create vault customer. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      customerId: result.customerId,
      billingId: result.billingId,
      created: !result.alreadyExisted,
    });
  } catch (error) {
    console.error("POST /api/tenant/vault-status error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

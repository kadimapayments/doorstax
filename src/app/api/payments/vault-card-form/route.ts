import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateVaultCardForm } from "@/lib/kadima/customer-vault";
import { provisionVaultCustomer } from "@/lib/kadima/provision-vault-customer";
import { getMerchantCredentialsForTenant } from "@/lib/kadima/merchant-context";
import { merchantGenerateVaultCardForm } from "@/lib/kadima/merchant-vault";

/**
 * POST /api/payments/vault-card-form
 *
 * Generates a Kadima Customer Vault Hosted Card Form URL.
 * This is the PCI-compliant way to add cards directly to the vault
 * without handling raw card data on our server.
 *
 * Body: { returnUrl?: string }
 * Returns: { url: string, code: string, customerId: string }
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !["TENANT", "PM", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { returnUrl } = body as { returnUrl?: string };

    let customerId: string | null = null;

    if (session.user.role === "PM" || session.user.role === "ADMIN") {
      // PM/Admin: use User record for vault customer
      const user = await db.user.findUnique({
        where: { id: session.user.id },
        select: {
          kadimaCustomerId: true,
          name: true,
          email: true,
          phone: true,
        },
      });

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      customerId = user.kadimaCustomerId;
      if (!customerId) {
        // Create a Kadima vault customer for the PM
        const { createCustomer } = await import("@/lib/kadima/customer-vault");
        const nameParts = (user.name || "").split(" ");
        const result = await createCustomer({
          firstName: nameParts[0] || "PM",
          lastName: nameParts.slice(1).join(" ") || "User",
          email: user.email || "",
          phone: user.phone || undefined,
        });
        const resultAny = result as unknown as Record<string, any>;
        customerId = resultAny.id != null ? String(resultAny.id) : null;
        if (customerId) {
          await db.user.update({
            where: { id: session.user.id },
            data: { kadimaCustomerId: customerId },
          });
        }
      }
    } else {
      // Tenant: use TenantProfile for vault customer
      const profile = await db.tenantProfile.findUnique({
        where: { userId: session.user.id },
        select: {
          id: true,
          kadimaCustomerId: true,
          kadimaBillingId: true,
          user: { select: { name: true, email: true, phone: true } },
        },
      });

      if (!profile) {
        return NextResponse.json({ error: "Profile not found" }, { status: 404 });
      }

      customerId = profile.kadimaCustomerId;
      if (!customerId) {
        const nameParts = (profile.user?.name || session.user.name || "").split(" ");
        const result = await provisionVaultCustomer({
          tenantProfileId: profile.id,
          firstName: nameParts[0] || "Tenant",
          lastName: nameParts.slice(1).join(" ") || "",
          email: profile.user?.email || session.user.email || "",
          phone: profile.user?.phone || undefined,
        });
        customerId = result.customerId;
      }
      // If the customer existed but has no billing record yet, run the
      // provisioner to create one — billingId is required to skip the
      // in-iframe address step.
      if (customerId && !profile.kadimaBillingId) {
        const nameParts = (profile.user?.name || session.user.name || "").split(" ");
        await provisionVaultCustomer({
          tenantProfileId: profile.id,
          firstName: nameParts[0] || "Tenant",
          lastName: nameParts.slice(1).join(" ") || "",
          email: profile.user?.email || session.user.email || "",
          phone: profile.user?.phone || undefined,
        });
      }
    }

    if (!customerId) {
      return NextResponse.json(
        { error: "Failed to create payment vault customer" },
        { status: 500 }
      );
    }

    // Resolve merchant credentials based on role
    let formData;
    if (session.user.role === "PM" || session.user.role === "ADMIN") {
      // PM/Admin: use global vault form (platform billing context)
      formData = await generateVaultCardForm(customerId, returnUrl);
    } else {
      // Tenant: use PM's merchant credentials for the card form. Pass the
      // tenant's pre-existing billingId so Kadima skips the address step.
      const profile = await db.tenantProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true, kadimaBillingId: true },
      });
      const billingId = profile?.kadimaBillingId || undefined;
      if (profile) {
        try {
          const merchantCreds = await getMerchantCredentialsForTenant(profile.id);
          formData = await merchantGenerateVaultCardForm(merchantCreds, customerId, returnUrl, billingId);
        } catch (credErr) {
          console.warn("[vault-card-form] Merchant credentials not available, falling back to global:", credErr);
          formData = await generateVaultCardForm(customerId, returnUrl, billingId);
        }
      } else {
        formData = await generateVaultCardForm(customerId, returnUrl);
      }
    }

    return NextResponse.json({
      url: formData.url,
      code: formData.code,
      customerId,
    });
  } catch (error: any) {
    console.error("[vault-card-form] Error:", {
      message: error?.message,
      status: error?.response?.status,
      data: JSON.stringify(error?.response?.data),
    });
    return NextResponse.json(
      { error: "Failed to generate card form" },
      { status: 500 }
    );
  }
}

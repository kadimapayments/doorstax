import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateVaultCardForm } from "@/lib/kadima/customer-vault";
import { provisionVaultCustomer } from "@/lib/kadima/provision-vault-customer";

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

    // Get tenant profile
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

    // Ensure vault customer exists
    let customerId = profile.kadimaCustomerId;
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

    if (!customerId) {
      return NextResponse.json(
        { error: "Failed to create payment vault customer" },
        { status: 500 }
      );
    }

    // Generate the hosted card form
    const formData = await generateVaultCardForm(customerId, returnUrl);

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

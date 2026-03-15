import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { provisionVaultCustomer } from "@/lib/kadima/provision-vault-customer";

/**
 * POST /api/admin/backfill-vault-customers
 *
 * Backfill Kadima Customer Vault records for existing tenants
 * that were created before auto-provisioning was implemented.
 * ADMIN-only. Processes sequentially with throttling.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find all active tenants without a vault customer
    const tenants = await db.tenantProfile.findMany({
      where: {
        kadimaCustomerId: null,
        status: "ACTIVE",
      },
      select: {
        id: true,
        user: { select: { name: true, email: true, phone: true } },
      },
    });

    const results = {
      total: tenants.length,
      provisioned: 0,
      failed: 0,
      skipped: 0,
    };

    for (const tenant of tenants) {
      try {
        const nameParts = (tenant.user.name || "").split(" ");
        const result = await provisionVaultCustomer({
          tenantProfileId: tenant.id,
          firstName: nameParts[0] || "Tenant",
          lastName: nameParts.slice(1).join(" ") || "",
          email: tenant.user.email || "",
          phone: tenant.user.phone || undefined,
        });

        if (result.alreadyExisted) {
          results.skipped++;
        } else if (result.customerId) {
          results.provisioned++;
        } else {
          results.failed++;
        }

        // Throttle to avoid Kadima API rate limits
        await new Promise((r) => setTimeout(r, 500));
      } catch {
        results.failed++;
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Backfill vault customers error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

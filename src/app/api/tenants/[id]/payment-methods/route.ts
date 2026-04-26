export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveApiLandlord } from "@/lib/api-landlord";

/**
 * GET /api/tenants/[id]/payment-methods
 *
 * Returns the payment methods available for a specific tenant given
 * their unit's owner config. Drives the method picker on the
 * Charge Tenant form so we never offer a method that can't possibly
 * succeed (the bug Walter Parker exposed).
 *
 * Auth via `resolveApiLandlord` so admin "View as PM" works alongside
 * regular PM and team-member access.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await resolveApiLandlord();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: tenantId } = await params;

  // Look up the tenant + their unit + the owner of that property,
  // scoped to the resolved landlord. The owner-cash-toggles flow
  // (offline payments) writes acceptsCash / acceptsChecks on the
  // Owner row attached to the property; we read the same.
  const tenant = await db.tenantProfile.findFirst({
    where: {
      id: tenantId,
      unit: { property: { landlordId: ctx.landlordId } },
    },
    select: {
      id: true,
      kadimaCustomerId: true,
      kadimaCardTokenId: true,
      kadimaAccountId: true,
      cardBrand: true,
      cardLast4: true,
      bankLast4: true,
      bankAccountType: true,
      unit: {
        select: {
          property: {
            select: {
              owner: {
                select: {
                  acceptsCash: true,
                  acceptsChecks: true,
                  cashHandlingMode: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  // Build availability list — only methods that can actually succeed.
  const hasCard = !!(tenant.kadimaCustomerId && tenant.kadimaCardTokenId);
  const hasAch = !!(tenant.kadimaCustomerId && tenant.kadimaAccountId);
  const acceptsCash = tenant.unit?.property?.owner?.acceptsCash ?? false;
  const acceptsChecks = tenant.unit?.property?.owner?.acceptsChecks ?? false;

  const available: string[] = [];
  if (hasCard) available.push("card");
  if (hasAch) available.push("ach");
  if (acceptsCash) available.push("cash");
  if (acceptsChecks) available.push("check");

  return NextResponse.json({
    tenant: {
      hasCard,
      cardBrand: tenant.cardBrand,
      cardLast4: tenant.cardLast4,
      hasAch,
      bankLast4: tenant.bankLast4,
      bankAccountType: tenant.bankAccountType,
    },
    owner: {
      acceptsCash,
      acceptsChecks,
      cashHandlingMode:
        tenant.unit?.property?.owner?.cashHandlingMode ?? "DISABLED",
    },
    available,
  });
}

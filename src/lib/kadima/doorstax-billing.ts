/**
 * DoorStax Platform Billing — Kadima vault customer management for PMs.
 *
 * Creates a vault customer under DoorStax's own MID/DBA so the platform
 * can charge the $150+/mo software fee to each PM.
 */

import { db } from "@/lib/db";
import { vaultClient, withRetry } from "./client";
import type { Customer, BillingInfo } from "./types";
import { formatPhoneE164 } from "./phone";

/**
 * Get the DoorStax platform DBA ID (separate from PM's DBA).
 * Falls back to KADIMA_DBA_ID if DOORSTAX_DBA_ID is not set.
 */
function getDoorstaxDbaId(): string {
  const dbaId = process.env.DOORSTAX_DBA_ID || process.env.KADIMA_DBA_ID;
  if (!dbaId) {
    throw new Error("DOORSTAX_DBA_ID (or KADIMA_DBA_ID) is required for platform billing");
  }
  return dbaId;
}

interface CreateDoorstaxCustomerOpts {
  name: string;
  email: string;
  phone?: string;
}

/**
 * Create a Kadima vault customer under the DoorStax platform DBA
 * so monthly software fees can be charged.
 *
 * Idempotent — if the user already has `kadimaCustomerId`, returns early.
 * Never throws — returns null on failure.
 */
export async function createDoorstaxCustomer(
  userId: string,
  opts: CreateDoorstaxCustomerOpts
): Promise<{ customerId: string | null; billingId: string | null }> {
  try {
    // Check if already provisioned
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { kadimaCustomerId: true, kadimaBillingId: true },
    });

    if (user?.kadimaCustomerId) {
      return {
        customerId: user.kadimaCustomerId,
        billingId: user.kadimaBillingId || null,
      };
    }

    const dbaId = getDoorstaxDbaId();
    const [firstName, ...lastParts] = opts.name.split(" ");
    const lastName = lastParts.join(" ") || firstName;
    const phone = formatPhoneE164(opts.phone);

    // Create vault customer under DoorStax DBA
    const customer: Customer = await withRetry(async () => {
      const { data } = await vaultClient.post("/customer-vault", {
        dba: { id: Number(dbaId) },
        email: opts.email,
        ...(phone ? { phone } : {}),
        identificator: `pm-${userId}`,
      });
      return data;
    });

    const customerId = String(customer.id);

    // Create default billing info (required before card operations)
    let billingId: string | null = null;
    try {
      const billing: BillingInfo = await withRetry(async () => {
        const { data } = await vaultClient.post(
          `/customer-vault/${customerId}/billing-information`,
          {
            firstName,
            lastName,
            company: "On File",
            address: "On File",
            city: "On File",
            state: "",
            zip: "00000",
            country: "US",
            phone: phone || "",
            email: opts.email,
          }
        );
        return data;
      });
      billingId = String(billing.id);
    } catch (err) {
      console.error("[doorstax-billing] Failed to create billing info:", err);
    }

    // Store on User record
    await db.user.update({
      where: { id: userId },
      data: {
        kadimaCustomerId: customerId,
        kadimaBillingId: billingId,
      },
    });

    console.log(`[doorstax-billing] Created vault customer ${customerId} for PM ${userId}`);
    return { customerId, billingId };
  } catch (err) {
    console.error("[doorstax-billing] Failed to create vault customer:", err);
    return { customerId: null, billingId: null };
  }
}

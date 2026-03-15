import { db } from "@/lib/db";
import { createCustomer, listCustomers, createBillingInfo } from "./customer-vault";
import { auditLog } from "@/lib/audit";

interface ProvisionOptions {
  tenantProfileId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

interface ProvisionResult {
  customerId: string | null;
  billingId: string | null;
  alreadyExisted: boolean;
}

/**
 * Format a phone number to E.164 format.
 * Kadima requires E.164 (e.g. +18187740010).
 *
 *  - 10 digits → +1{digits}  (US number)
 *  - 11 digits starting with 1 → +{digits}
 *  - Already has + → keep as-is
 *  - Otherwise → return undefined (don't send invalid phone)
 */
function formatPhoneE164(phone: string | undefined | null): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (phone.startsWith("+") && digits.length >= 10) return phone;
  // Can't reliably format — omit to avoid Kadima rejection
  console.warn(`[provision-vault] Cannot format phone to E.164: "${phone}", omitting`);
  return undefined;
}

/**
 * Provision a Kadima Customer Vault record for a tenant.
 *
 * Idempotent — if the tenant already has a `kadimaCustomerId`, returns it
 * without calling the Kadima API. On API failure, logs the error and returns
 * `{ customerId: null }` — **never throws**.
 *
 * Also creates a default billing info record (required before adding cards).
 */
export async function provisionVaultCustomer(
  opts: ProvisionOptions
): Promise<ProvisionResult> {
  try {
    // 1. Check if already provisioned (idempotency guard)
    const profile = await db.tenantProfile.findUnique({
      where: { id: opts.tenantProfileId },
      select: { id: true, kadimaCustomerId: true, kadimaBillingId: true },
    });

    if (!profile) {
      console.error(
        `[provision-vault] TenantProfile not found: ${opts.tenantProfileId}`
      );
      return { customerId: null, billingId: null, alreadyExisted: false };
    }

    if (profile.kadimaCustomerId) {
      // Already provisioned — ensure billing info exists
      let billingId = profile.kadimaBillingId || null;
      if (!billingId) {
        billingId = await ensureBillingInfo(
          profile.kadimaCustomerId,
          opts,
          profile.id
        );
      }
      return {
        customerId: profile.kadimaCustomerId,
        billingId,
        alreadyExisted: true,
      };
    }

    // 2. Create customer in Kadima vault
    const formattedPhone = formatPhoneE164(opts.phone);

    console.log(
      `[provision-vault] Creating vault customer for tenant ${opts.tenantProfileId}: ${opts.firstName} ${opts.lastName} <${opts.email}>`
    );

    const customerPayload: Record<string, unknown> = {
      firstName: opts.firstName || "Tenant",
      lastName: opts.lastName || "",
      email: opts.email,
      identificator: opts.tenantProfileId,
    };
    if (formattedPhone) {
      customerPayload.phone = formattedPhone;
    }

    const result = await createCustomer(customerPayload as any);

    console.log(
      `[provision-vault] Kadima createCustomer response:`,
      JSON.stringify(result)
    );

    // Kadima returns the customer object directly (not wrapped in data)
    const resultAny = result as unknown as Record<string, any>;
    const customerId: string | undefined =
      resultAny.id != null ? String(resultAny.id) : undefined;

    if (!customerId) {
      console.error(
        `[provision-vault] Kadima returned no customer ID for tenant ${opts.tenantProfileId}`,
        JSON.stringify(result)
      );
      return { customerId: null, billingId: null, alreadyExisted: false };
    }

    // 3. Store the vault customer ID
    await db.tenantProfile.update({
      where: { id: opts.tenantProfileId },
      data: { kadimaCustomerId: customerId },
    });

    // 4. Create default billing info (required before adding cards)
    const billingId = await ensureBillingInfo(customerId, opts, profile.id);

    // 5. Audit log (fire-and-forget)
    auditLog({
      action: "CREATE",
      objectType: "KadimaVaultCustomer",
      objectId: customerId,
      description: `Provisioned Kadima vault customer for tenant ${opts.tenantProfileId}`,
      newValue: {
        tenantProfileId: opts.tenantProfileId,
        kadimaCustomerId: customerId,
        kadimaBillingId: billingId,
      },
    }).catch(() => {});

    return { customerId, billingId, alreadyExisted: false };
  } catch (error: any) {
    const axiosData = error?.response?.data;
    const axiosStatus = error?.response?.status;
    const errorMessage = axiosData?.message || error?.message || "";

    // Handle "already exists" — customer was previously created in Kadima
    // but our DB lost the reference. Look up by identificator and re-link.
    if (
      axiosStatus === 400 &&
      errorMessage.toLowerCase().includes("already")
    ) {
      console.warn(
        `[provision-vault] Customer already exists in Kadima for tenant ${opts.tenantProfileId}, looking up...`
      );
      try {
        const existing = await listCustomers({
          identificator: opts.tenantProfileId,
        });
        const items = existing?.items || [];
        const found = items.find(
          (c: any) => c.identificator === opts.tenantProfileId
        );
        if (found?.id) {
          const customerId = String(found.id);
          console.log(
            `[provision-vault] Re-linked existing Kadima customer ${customerId} for tenant ${opts.tenantProfileId}`
          );
          await db.tenantProfile.update({
            where: { id: opts.tenantProfileId },
            data: { kadimaCustomerId: customerId },
          });
          // Ensure billing info
          const billingId = await ensureBillingInfo(
            customerId,
            opts,
            opts.tenantProfileId
          );
          return { customerId, billingId, alreadyExisted: true };
        }
      } catch (lookupErr) {
        console.error("[provision-vault] Lookup of existing customer failed:", lookupErr);
      }
    }

    console.error(
      `[provision-vault] Failed to provision vault customer for tenant ${opts.tenantProfileId}:`,
      {
        message: error?.message,
        status: axiosStatus,
        data: JSON.stringify(axiosData),
        email: opts.email,
        phone: opts.phone || "(not provided)",
      }
    );
    return { customerId: null, billingId: null, alreadyExisted: false };
  }
}

/**
 * Create a default billing info record for a vault customer.
 * This is required before cards can be added (card requires billing.id).
 *
 * Returns the billing ID or null on failure.
 */
async function ensureBillingInfo(
  customerId: string,
  opts: ProvisionOptions,
  profileId: string
): Promise<string | null> {
  try {
    const billingPayload = {
      firstName: opts.firstName || "Tenant",
      lastName: opts.lastName || "",
      address: "N/A",       // Placeholder — updated when tenant provides real address
      country: "US",
      city: "N/A",
      zip: "00000",
    };

    console.log(
      `[provision-vault] Creating billing info for customer ${customerId}`
    );

    const billingResult = await createBillingInfo(customerId, billingPayload);
    const billingAny = billingResult as unknown as Record<string, any>;
    const billingId =
      billingAny.id != null ? String(billingAny.id) : null;

    if (billingId) {
      console.log(
        `[provision-vault] Created billing info ${billingId} for customer ${customerId}`
      );
      // Store billing ID in tenant profile
      await db.tenantProfile.update({
        where: { id: profileId },
        data: { kadimaBillingId: billingId },
      });
    }

    return billingId;
  } catch (err: any) {
    console.error(
      `[provision-vault] Failed to create billing info for customer ${customerId}:`,
      {
        message: err?.message,
        status: err?.response?.status,
        data: JSON.stringify(err?.response?.data),
      }
    );
    return null;
  }
}

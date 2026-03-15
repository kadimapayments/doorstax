import { db } from "@/lib/db";
import { createCustomer, listCustomers } from "./customer-vault";
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
  alreadyExisted: boolean;
}

/**
 * Provision a Kadima Customer Vault record for a tenant.
 *
 * Idempotent — if the tenant already has a `kadimaCustomerId`, returns it
 * without calling the Kadima API. On API failure, logs the error and returns
 * `{ customerId: null }` — **never throws**.
 */
export async function provisionVaultCustomer(
  opts: ProvisionOptions
): Promise<ProvisionResult> {
  try {
    // 1. Check if already provisioned (idempotency guard)
    const profile = await db.tenantProfile.findUnique({
      where: { id: opts.tenantProfileId },
      select: { id: true, kadimaCustomerId: true },
    });

    if (!profile) {
      console.error(
        `[provision-vault] TenantProfile not found: ${opts.tenantProfileId}`
      );
      return { customerId: null, alreadyExisted: false };
    }

    if (profile.kadimaCustomerId) {
      return { customerId: profile.kadimaCustomerId, alreadyExisted: true };
    }

    // 2. Create customer in Kadima vault
    //    Kadima requires: dba.id (added by createCustomer), email
    //    Phone is optional — do NOT send a placeholder; Kadima rejects invalid phones.
    console.log(
      `[provision-vault] Creating vault customer for tenant ${opts.tenantProfileId}: ${opts.firstName} ${opts.lastName} <${opts.email}>`
    );

    const customerPayload: Record<string, unknown> = {
      firstName: opts.firstName || "Tenant",
      lastName: opts.lastName || "",
      email: opts.email,
      identificator: opts.tenantProfileId, // Link back to our tenant profile
    };
    // Only include phone if tenant actually has one
    if (opts.phone) {
      customerPayload.phone = opts.phone;
    }

    const result = await createCustomer(customerPayload as any);

    console.log(
      `[provision-vault] Kadima createCustomer response:`,
      JSON.stringify(result)
    );

    // Kadima returns { id, dba, firstName, ... } directly (not wrapped in data)
    const resultAny = result as unknown as Record<string, any>;
    const customerId: string | undefined =
      resultAny.id ?? resultAny.data?.id ?? undefined;

    if (!customerId) {
      console.error(
        `[provision-vault] Kadima returned no customer ID for tenant ${opts.tenantProfileId}`,
        JSON.stringify(result)
      );
      return { customerId: null, alreadyExisted: false };
    }

    // 3. Store the vault customer ID
    await db.tenantProfile.update({
      where: { id: opts.tenantProfileId },
      data: { kadimaCustomerId: customerId },
    });

    // 4. Audit log (fire-and-forget)
    auditLog({
      action: "CREATE",
      objectType: "KadimaVaultCustomer",
      objectId: customerId,
      description: `Provisioned Kadima vault customer for tenant ${opts.tenantProfileId}`,
      newValue: {
        tenantProfileId: opts.tenantProfileId,
        kadimaCustomerId: customerId,
      },
    }).catch(() => {});

    return { customerId, alreadyExisted: false };
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
          // @ts-expect-error — identificator filter works per Kadima API
          identificator: opts.tenantProfileId,
        });
        const items = (existing as any)?.items || (existing as any)?.data || [];
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
          return { customerId, alreadyExisted: true };
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
    return { customerId: null, alreadyExisted: false };
  }
}

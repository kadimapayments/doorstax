/**
 * Merchant Context Resolver
 *
 * Resolves the correct Kadima API credentials for a given context.
 * In DoorStax, each PM is a separate Kadima merchant. When processing
 * a payment for a tenant, we need to resolve: tenant → unit → property → PM → credentials.
 *
 * Two credential tiers:
 * 1. PM merchant credentials (kadimaMerchantApiKey, kadimaMerchantTerminalId) — for tenant payments
 * 2. Platform credentials (KADIMA_API_TOKEN, KADIMA_DBA_ID) — for DoorStax billing, boarding
 */

import { db } from "@/lib/db";

export interface MerchantCredentials {
  apiKey: string;
  terminalId: string;
  /** PM user ID these credentials belong to */
  pmUserId: string;
  /** Source: "database" if resolved from PM record, "env" if fallback to global */
  source: "database" | "env";
}

/**
 * Resolve merchant credentials for a PM by their user ID.
 * Throws if PM has no credentials configured.
 */
export async function getMerchantCredentials(pmUserId: string): Promise<MerchantCredentials> {
  const pm = await db.user.findUnique({
    where: { id: pmUserId },
    select: {
      kadimaMerchantApiKey: true,
      kadimaMerchantTerminalId: true,
      managerStatus: true,
    },
  });

  if (!pm) {
    throw new Error(`PM user not found: ${pmUserId}`);
  }

  // If PM has merchant credentials, use them
  if (pm.kadimaMerchantApiKey && pm.kadimaMerchantTerminalId) {
    return {
      apiKey: pm.kadimaMerchantApiKey,
      terminalId: pm.kadimaMerchantTerminalId,
      pmUserId,
      source: "database",
    };
  }

  // Fallback to global env vars (single-merchant mode / development)
  const envKey = process.env.KADIMA_API_TOKEN;
  const envTerminal = process.env.KADIMA_TERMINAL_ID;

  if (!envKey || !envTerminal) {
    throw new Error(
      `PM ${pmUserId} has no Kadima merchant credentials, and no global fallback is configured. ` +
      `Set kadimaMerchantApiKey and kadimaMerchantTerminalId on the PM record, ` +
      `or set KADIMA_API_TOKEN and KADIMA_TERMINAL_ID env vars.`
    );
  }

  console.warn(
    `[merchant-context] PM ${pmUserId} using global fallback credentials. ` +
    `This is acceptable for development but NOT for production multi-merchant.`
  );

  return {
    apiKey: envKey,
    terminalId: envTerminal,
    pmUserId,
    source: "env",
  };
}

/**
 * Resolve merchant credentials from a tenant profile ID.
 * Walks: tenantProfile → unit → property → landlord (PM) → credentials
 */
export async function getMerchantCredentialsForTenant(tenantProfileId: string): Promise<MerchantCredentials> {
  const profile = await db.tenantProfile.findUnique({
    where: { id: tenantProfileId },
    select: {
      unit: {
        select: {
          property: {
            select: {
              landlordId: true,
              kadimaTerminalId: true,
            },
          },
        },
      },
    },
  });

  if (!profile?.unit?.property?.landlordId) {
    throw new Error(`Cannot resolve PM for tenant profile: ${tenantProfileId}`);
  }

  const creds = await getMerchantCredentials(profile.unit.property.landlordId);

  // Property-level terminal override takes precedence over PM-level default
  if (profile.unit.property.kadimaTerminalId) {
    return {
      ...creds,
      terminalId: profile.unit.property.kadimaTerminalId,
    };
  }

  return creds;
}

/**
 * Resolve merchant credentials from a unit ID.
 * Walks: unit → property → landlord (PM) → credentials
 */
export async function getMerchantCredentialsForUnit(unitId: string): Promise<MerchantCredentials> {
  const unit = await db.unit.findUnique({
    where: { id: unitId },
    select: {
      property: {
        select: {
          landlordId: true,
          kadimaTerminalId: true,
        },
      },
    },
  });

  if (!unit?.property?.landlordId) {
    throw new Error(`Cannot resolve PM for unit: ${unitId}`);
  }

  const creds = await getMerchantCredentials(unit.property.landlordId);

  if (unit.property.kadimaTerminalId) {
    return {
      ...creds,
      terminalId: unit.property.kadimaTerminalId,
    };
  }

  return creds;
}

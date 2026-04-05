/**
 * Kadima Dashboard Lead + Boarding Sync
 *
 * Uses the Kadima Processor (Dashboard) API — NOT the Gateway API.
 *
 * Endpoints:
 *   POST /boarding-application/create   — create a new merchant application
 *   PUT  /boarding-application/:id     — update company / business data
 *   PUT  /boarding-application/:id/principal/:pid — update principal info
 *
 * Env vars:
 *   KADIMA_PROCESSOR_BASE  — e.g. https://sandbox.kadimadashboard.com/api
 *   KADIMA_PROCESSOR_TOKEN — Processor-level Bearer token
 *   KADIMA_CAMPAIGN_ID     — Boarding campaign ID (1106 for production, 1 for sandbox)
 */

import { buildKadimaAddress, getKadimaStateId } from "./state-lookup";

function getCampaignId(): number {
  const envCampaignId = process.env.KADIMA_CAMPAIGN_ID;
  if (!envCampaignId) {
    console.warn(
      "[kadima-lead] KADIMA_CAMPAIGN_ID not set — defaulting to sandbox campaign 1. " +
      "Set KADIMA_CAMPAIGN_ID=1106 for production."
    );
    return 1; // Sandbox default
  }
  return parseInt(envCampaignId, 10);
}

/* ── Helpers ────────────────────────────────────────────────── */

function getProcessorConfig() {
  const BASE =
    process.env.KADIMA_PROCESSOR_BASE ||
    "https://sandbox.kadimadashboard.com/api";
  const TOKEN = process.env.KADIMA_PROCESSOR_TOKEN;
  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
  };
  return { BASE, TOKEN, headers };
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  const first = parts[0] || "";
  const last = parts.slice(1).join(" ") || "";
  return { first, last };
}

/* ── Lead Creation (called at registration) ─────────────────── */

interface LeadData {
  name: string;
  email: string;
  phone?: string;
  company?: string;
}

/**
 * Creates a boarding application in the Kadima Dashboard.
 * Returns the Kadima app ID + principal ID, or null on failure.
 */
export async function createKadimaLead(
  data: LeadData
): Promise<{ appId: number; principalId: number } | null> {
  const { BASE, TOKEN, headers } = getProcessorConfig();

  if (!TOKEN) {
    console.warn("[kadima-lead] KADIMA_PROCESSOR_TOKEN not set, skipping lead");
    return null;
  }

  try {
    // ── Step 1: Create the boarding application ─────────────
    const createRes = await fetch(`${BASE}/boarding-application/create`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        processingMethod: "Acquiring",
        campaign: { id: getCampaignId() },
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.text().catch(() => "");
      console.warn(
        `[kadima-lead] Create failed: ${createRes.status}`,
        err.slice(0, 200)
      );
      return null;
    }

    const app = await createRes.json();
    const appId = app.id as number;
    const principalId = (app.principals?.[0]?.id as number) ?? 0;

    if (!appId) {
      console.warn("[kadima-lead] No application ID returned");
      return null;
    }

    // ── Step 2: Update company / DBA / service description ──
    const { first, last } = splitName(data.name);
    const companyName = data.company || `${data.name} Properties`;

    await fetch(`${BASE}/boarding-application/${appId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        processingMethod: "Acquiring",
        campaign: { id: getCampaignId() },
        company: { name: companyName },
        dba: { name: companyName },
        serviceDescription: "Property Management",
      }),
    });

    // ── Step 3: Update principal contact info ───────────────
    if (principalId) {
      await fetch(
        `${BASE}/boarding-application/${appId}/principal/${principalId}`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({
            name: { first, last },
            email: data.email,
          }),
        }
      );
    }

    console.log(
      `[kadima-lead] Lead created for ${data.email} (app #${appId})`
    );
    return { appId, principalId };
  } catch (err) {
    console.warn("[kadima-lead] Error creating lead:", err);
    return null;
  }
}

/* ── Boarding Sync (called at onboarding step 5 submit) ──── */

export interface BoardingData {
  kadimaAppId: string | null;
  businessLegalName?: string | null;
  dba?: string | null;
  ein?: string | null;
  businessAddress?: string | null;
  businessCity?: string | null;
  businessState?: string | null;
  businessZip?: string | null;
  businessPhone?: string | null;
  businessEmail?: string | null;
  websiteUrl?: string | null;
  principalFirstName?: string | null;
  principalLastName?: string | null;
  principalTitle?: string | null;
  principalDob?: Date | null;
  principalAddress?: string | null;
  principalCity?: string | null;
  principalState?: string | null;
  principalZip?: string | null;
  ownershipPercent?: number | null;
  monthlyVolume?: unknown;
  averageTransaction?: unknown;
  maxTransactionAmount?: unknown;
  numberOfUnits?: number | null;
  // Processing section fields
  salesMethodInPerson?: number | null;
  salesMethodMailPhone?: number | null;
  salesMethodEcommerce?: number | null;
  bankRoutingNumber?: string | null;
  bankAccountNumber?: string | null;
  currentlyProcessCards?: boolean | null;
  currentProcessor?: string | null;
  everTerminated?: boolean | null;
  terminatedExplanation?: string | null;
  customerProfileConsumer?: number | null;
  customerProfileBusiness?: number | null;
  customerProfileGovernment?: number | null;
  customerLocationLocal?: number | null;
  customerLocationNational?: number | null;
  customerLocationInternational?: number | null;
  fulfillmentTiming?: string | null;
  deliveryTiming?: string | null;
  refundPolicy?: string | null;
  equipmentUsed?: string | null;
  recurringServices?: string | null;
  isSeasonal?: boolean | null;
  seasonalMonths?: string | null;
  hasRetailLocation?: boolean | null;
  retailLocationAddress?: string | null;
  advertisingMethods?: string | null;
  // principals array (already handled separately)
  principals?: unknown;
}

/**
 * Syncs the full DoorStax merchant application data to the linked
 * Kadima boarding application. Called when the PM submits step 5.
 */
export async function syncKadimaBoarding(app: BoardingData): Promise<void> {
  const { BASE, TOKEN, headers } = getProcessorConfig();

  if (!TOKEN) {
    console.warn("[kadima-boarding] KADIMA_PROCESSOR_TOKEN not set, skipping sync");
    return;
  }

  const kadimaId = app.kadimaAppId;
  if (!kadimaId) {
    console.warn("[kadima-boarding] No kadimaAppId, skipping sync");
    return;
  }

  try {
    // ── Get existing app to find principal ID ───────────────
    const getRes = await fetch(`${BASE}/boarding-application/${kadimaId}`, {
      method: "GET",
      headers,
    });

    if (!getRes.ok) {
      console.warn(
        `[kadima-boarding] GET app ${kadimaId} failed: ${getRes.status}`
      );
      return;
    }

    const kadimaApp = await getRes.json();
    const principalId = kadimaApp.principals?.[0]?.id;

    // ── PUT company / business data ─────────────────────────
    const companyRes = await fetch(`${BASE}/boarding-application/${kadimaId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        processingMethod: "Acquiring",
        campaign: { id: getCampaignId() },
        company: {
          name: app.businessLegalName || undefined,
          federalTaxId: app.ein || undefined,
          address: buildKadimaAddress({
            street: app.businessAddress,
            city: app.businessCity,
            state: app.businessState,
            zip: app.businessZip,
          }),
        },
        dba: {
          name: app.dba || app.businessLegalName || undefined,
        },
        website: app.websiteUrl || undefined,
        serviceDescription: "Property Management",
        corporateContact: {
          phone: app.businessPhone || undefined,
          email: app.businessEmail || undefined,
        },
      }),
    });

    if (!companyRes.ok) {
      const errBody = await companyRes.text().catch(() => "");
      console.error(`[kadima-boarding] PUT company failed: ${companyRes.status} ${errBody}`);
    }

    // ── PUT processing section (dedicated endpoint) ─────────
    const hasSalesMethod = app.salesMethodInPerson != null || app.salesMethodMailPhone != null || app.salesMethodEcommerce != null;
    const hasBank = app.bankRoutingNumber || app.bankAccountNumber;
    const hasVolumes = app.monthlyVolume || app.averageTransaction;

    if (hasSalesMethod || hasBank || hasVolumes) {
      const processingPayload: Record<string, unknown> = {};

      // Bank account
      if (hasBank) {
        processingPayload.bank = {
          ...(app.bankAccountNumber ? { accountNumber: app.bankAccountNumber } : {}),
          ...(app.bankRoutingNumber ? { routingNumber: app.bankRoutingNumber } : {}),
        };
      }

      // Volumes
      if (hasVolumes) {
        processingPayload.volumes = {
          ...(app.monthlyVolume ? { monthlyTransactionAmount: Number(app.monthlyVolume) } : {}),
          ...(app.averageTransaction ? { avgTransactionAmount: Number(app.averageTransaction) } : {}),
          ...(app.maxTransactionAmount ? { maxTransactionAmount: Number(app.maxTransactionAmount) } : {}),
        };
      }

      // Sales method percentages (must sum to 100 in Kadima)
      if (hasSalesMethod) {
        processingPayload.sales = {
          swiped: app.salesMethodInPerson ?? 0,
          mail: app.salesMethodMailPhone ?? 0,
          internet: app.salesMethodEcommerce ?? 0,
        };
      }

      // Already processing
      processingPayload.alreadyProcessing = {
        isProcessing: app.currentlyProcessCards ? "Yes" : "No",
        ...(app.currentProcessor ? { processor: app.currentProcessor } : {}),
      };

      // Terminated
      processingPayload.terminated = {
        isTerminated: app.everTerminated ? "Yes" : "No",
        ...(app.terminatedExplanation ? { description: app.terminatedExplanation } : {}),
      };

      // Customer types
      if (app.customerProfileConsumer != null || app.customerProfileBusiness != null) {
        processingPayload.customers = {
          type: {
            individual: app.customerProfileConsumer ?? 0,
            business: app.customerProfileBusiness ?? 0,
            government: app.customerProfileGovernment ?? 0,
          },
          location: {
            local: app.customerLocationLocal ?? 0,
            national: app.customerLocationNational ?? 0,
            international: app.customerLocationInternational ?? 0,
          },
        };
      }

      // Fulfillment policy
      if (app.fulfillmentTiming || app.deliveryTiming) {
        processingPayload.fulfillmentPolicy = {
          ...(app.fulfillmentTiming ? { fulfillment: app.fulfillmentTiming } : {}),
          ...(app.deliveryTiming ? { delivery: app.deliveryTiming } : {}),
        };
      }

      // Recurring payments
      if (app.recurringServices) {
        processingPayload.recurringPayments = {
          hasRecurring: "Yes",
          description: app.recurringServices,
        };
      }

      // Seasonal business
      if (app.isSeasonal != null) {
        processingPayload.seasonalBusiness = {
          isSeasonal: app.isSeasonal ? "Yes" : "No",
          ...(app.seasonalMonths ? { months: app.seasonalMonths } : {}),
        };
      }

      // Retail location
      if (app.hasRetailLocation != null) {
        processingPayload.retailLocation = app.retailLocationAddress || null;
      }

      // Equipment, refund, advertising
      if (app.equipmentUsed) processingPayload.equipmentUsed = app.equipmentUsed;
      if (app.refundPolicy) processingPayload.refundPolicy = app.refundPolicy;
      if (app.advertisingMethods) processingPayload.advertise = app.advertisingMethods;

      const processingRes = await fetch(
        `${BASE}/boarding-application/${kadimaId}/processing`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify(processingPayload),
        }
      );

      if (!processingRes.ok) {
        const errBody = await processingRes.text().catch(() => "");
        console.error(`[kadima-boarding] PUT processing failed: ${processingRes.status} ${errBody.slice(0, 300)}`);
      } else {
        console.log(`[kadima-boarding] Processing section synced for app #${kadimaId}`);
      }
    }

    // ── Sync ALL principals ─────────────────────────────────
    // Get existing principals from Kadima to avoid creating duplicates
    const kadimaExistingPrincipals = kadimaApp.principals || [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const principals = (app as any).principals as Array<{
      firstName: string;
      lastName: string;
      title?: string;
      dob?: string | Date;
      address?: string;
      city?: string;
      state?: string;
      zip?: string;
      ownershipPercent?: number;
      isManager?: boolean;
      ssn?: string;
      driversLicense?: string;
      driversLicenseExp?: string;
      email?: string;
      phone?: string;
      signatureBase64?: string;
      signedAt?: Date;
      signedIp?: string;
      signedUserAgent?: string;
    }> | undefined;

    if (principals && principals.length > 0) {
      for (let i = 0; i < principals.length; i++) {
        const p = principals[i];

        const principalPayload: Record<string, unknown> = {
          name: { first: p.firstName, last: p.lastName },
          title: p.title || undefined,
          ownershipPercentage: p.ownershipPercent ?? undefined,
          isManagement: p.isManager ? "Yes" : "No",
          isSigner: "Yes",
          ...(p.email ? { email: p.email } : {}),
          ...(p.phone ? { phone: p.phone } : {}),
        };

        if (p.dob) {
          const dob = p.dob instanceof Date ? p.dob : new Date(p.dob);
          if (!isNaN(dob.getTime())) {
            principalPayload.dayOfBirth = dob.toISOString().split("T")[0];
          }
        }

        if (p.ssn) {
          principalPayload.ssn = p.ssn;
        }

        if (p.driversLicense) {
          principalPayload.driverLicense = {
            number: p.driversLicense,
            ...(p.driversLicenseExp ? { expiration: p.driversLicenseExp } : {}),
            ...(p.state ? { state: { id: getKadimaStateId(p.state) } } : {}),
          };
        }

        if (p.address) {
          principalPayload.address = buildKadimaAddress({
            street: p.address,
            city: p.city,
            state: p.state,
            zip: p.zip,
          });
        }

        // If a Kadima principal exists at this index, UPDATE it
        const existingKadimaPrincipal = kadimaExistingPrincipals[i];
        if (existingKadimaPrincipal?.id) {
          try {
            const res = await fetch(
              `${BASE}/boarding-application/${kadimaId}/principal/${existingKadimaPrincipal.id}`,
              { method: "PUT", headers, body: JSON.stringify(principalPayload) }
            );
            if (!res.ok) {
              const errBody = await res.text().catch(() => "");
              console.error(`[kadima-boarding] PUT principal ${i} (${existingKadimaPrincipal.id}) failed: ${res.status} ${errBody.slice(0, 200)}`);
            }
          } catch (err) {
            console.error(`[kadima-boarding] Failed to update principal ${i}:`, err);
          }
        } else {
          // No existing principal at this index — POST a new one
          try {
            const res = await fetch(
              `${BASE}/boarding-application/${kadimaId}/principal`,
              { method: "POST", headers, body: JSON.stringify(principalPayload) }
            );
            if (!res.ok) {
              const errBody = await res.text().catch(() => "");
              console.error(`[kadima-boarding] POST principal ${i} failed: ${res.status} ${errBody.slice(0, 200)}`);
            }
          } catch (err) {
            console.error(`[kadima-boarding] Failed to add principal ${i}:`, err);
          }
        }
      }
    } else if (principalId) {
      // Fallback: no principals array but we have flat fields — update first principal
      const principalPayload: Record<string, unknown> = {
        name: {
          first: app.principalFirstName || undefined,
          last: app.principalLastName || undefined,
        },
        title: app.principalTitle || undefined,
        ownershipPercentage: app.ownershipPercent ?? undefined,
      };

      if (app.principalDob) {
        const dob = app.principalDob instanceof Date ? app.principalDob : new Date(app.principalDob);
        if (!isNaN(dob.getTime())) {
          principalPayload.dayOfBirth = dob.toISOString().split("T")[0];
        }
      }

      if (app.principalAddress) {
        principalPayload.address = buildKadimaAddress({
          street: app.principalAddress,
          city: app.principalCity,
          state: app.principalState,
          zip: app.principalZip,
        });
      }

      const res = await fetch(
        `${BASE}/boarding-application/${kadimaId}/principal/${principalId}`,
        { method: "PUT", headers, body: JSON.stringify(principalPayload) }
      );
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        console.error(`[kadima-boarding] PUT principal (fallback) failed: ${res.status} ${errBody.slice(0, 200)}`);
      }
    }

    console.log(
      `[kadima-boarding] Synced app #${kadimaId} with onboarding data`
    );
  } catch (err) {
    console.error("[kadima-boarding] Sync error:", err);
  }
}

/**
 * Kadima Dashboard Lead + Boarding Sync
 *
 * Uses the Kadima Processor (Dashboard) API — NOT the Gateway API.
 *
 * Endpoints:
 *   POST /boarding-application         — create a new merchant application
 *   PUT  /boarding-application/:id     — update company / business data
 *   PUT  /boarding-application/:id/principal/:pid — update principal info
 *
 * Env vars:
 *   KADIMA_PROCESSOR_BASE  — e.g. https://sandbox.kadimadashboard.com/api
 *   KADIMA_PROCESSOR_TOKEN — Processor-level Bearer token
 *   KADIMA_CAMPAIGN_ID     — Boarding campaign ID (1106 for production, 1 for sandbox)
 */

function getCampaignId(): number {
  return parseInt(process.env.KADIMA_CAMPAIGN_ID || "1106", 10);
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
    const createRes = await fetch(`${BASE}/boarding-application`, {
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
  numberOfUnits?: number | null;
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
          address: {
            street: app.businessAddress || undefined,
            city: app.businessCity || undefined,
            zip: app.businessZip || undefined,
          },
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
        processing: {
          volumes: {
            monthlyTransactionAmount: app.monthlyVolume
              ? Number(app.monthlyVolume)
              : undefined,
            avgTransactionAmount: app.averageTransaction
              ? Number(app.averageTransaction)
              : undefined,
          },
        },
      }),
    });

    if (!companyRes.ok) {
      const errBody = await companyRes.text().catch(() => "");
      console.error(`[kadima-boarding] PUT company failed: ${companyRes.status} ${errBody}`);
    }

    // ── PUT principal / owner data ──────────────────────────
    if (principalId) {
      const principalPayload: Record<string, unknown> = {
        name: {
          first: app.principalFirstName || undefined,
          last: app.principalLastName || undefined,
        },
        title: app.principalTitle || undefined,
        ownershipPercentage: app.ownershipPercent ?? undefined,
      };

      if (app.principalDob) {
        const dob =
          app.principalDob instanceof Date
            ? app.principalDob
            : new Date(app.principalDob);
        principalPayload.dayOfBirth = dob.toISOString().split("T")[0];
      }

      if (app.principalAddress) {
        principalPayload.address = {
          street: app.principalAddress || undefined,
          city: app.principalCity || undefined,
          zip: app.principalZip || undefined,
        };
      }

      const principalRes = await fetch(
        `${BASE}/boarding-application/${kadimaId}/principal/${principalId}`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify(principalPayload),
        }
      );

      if (!principalRes.ok) {
        const errBody = await principalRes.text().catch(() => "");
        console.error(`[kadima-boarding] PUT principal failed: ${principalRes.status} ${errBody}`);
      }
    }

    // ── Sync additional principals (if any) ──────────────────
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
    }> | undefined;

    if (principals && principals.length > 1) {
      // Additional principals beyond the first one
      for (let i = 1; i < principals.length; i++) {
        const p = principals[i];
        const addPrincipalPayload: Record<string, unknown> = {
          name: { first: p.firstName, last: p.lastName },
          title: p.title || undefined,
          ownershipPercentage: p.ownershipPercent ?? undefined,
        };

        if (p.dob) {
          const dob = p.dob instanceof Date ? p.dob : new Date(p.dob);
          if (!isNaN(dob.getTime())) {
            addPrincipalPayload.dayOfBirth = dob.toISOString().split("T")[0];
          }
        }

        if (p.address) {
          addPrincipalPayload.address = {
            street: p.address,
            city: p.city || undefined,
            zip: p.zip || undefined,
          };
        }

        try {
          const addRes = await fetch(
            `${BASE}/boarding-application/${kadimaId}/principal`,
            {
              method: "POST",
              headers,
              body: JSON.stringify(addPrincipalPayload),
            }
          );
          if (!addRes.ok) {
            const errBody = await addRes.text().catch(() => "");
            console.error(`[kadima-boarding] POST additional principal ${i} failed: ${addRes.status} ${errBody}`);
          }
        } catch (pErr) {
          console.error(`[kadima-boarding] Failed to add principal ${i}:`, pErr);
        }
      }
    }

    console.log(
      `[kadima-boarding] Synced app #${kadimaId} with onboarding data`
    );
  } catch (err) {
    console.error("[kadima-boarding] Sync error:", err);
  }
}

/**
 * Terminal Sync
 *
 * After a PM's merchant application is approved by Kadima, this module
 * fetches the merchant's terminals and stores them for use in payment routing.
 *
 * Kadima terminals are read-only — they're provisioned by Kadima during
 * merchant underwriting/approval. We can only LIST and VIEW them.
 *
 * Endpoints:
 *   GET /terminals — list all terminals for the authenticated merchant
 *   GET /terminal/:id — view a specific terminal
 */

import { db } from "@/lib/db";
import type { MerchantCredentials } from "./merchant-context";
import { createMerchantVaultClient } from "./merchant-client";
import { withRetry } from "./client";
import { auditLog } from "@/lib/audit";

export interface KadimaTerminal {
  id: number | string;
  dba: { id: number | string; name: string };
  merchant: { id: number | string; name: string };
  name: string;
  tid: number;
  vNumber: string;
  gateway: {
    provider: string;
    activatedOn: string | null;
    "3DsStatus": string;
  };
  website?: string;
  createdOn: string;
}

/**
 * Fetch all terminals for a merchant from Kadima.
 * Uses the PM's merchant API key to scope the request.
 */
export async function fetchMerchantTerminals(
  creds: MerchantCredentials
): Promise<KadimaTerminal[]> {
  const client = createMerchantVaultClient(creds);
  return withRetry(async () => {
    const { data } = await client.get("/terminals");
    // Kadima returns { items: [...], _links, _meta } for list endpoints
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = (data as any)?.items || (Array.isArray(data) ? data : []);
    return items;
  });
}

/**
 * Sync a PM's Kadima terminals to local storage.
 *
 * Called after merchant approval (via boarding status webhook).
 * Updates the PM's `kadimaMerchantTerminalId` with the first terminal found.
 * Also assigns the terminal to all of the PM's properties that don't have one.
 *
 * Returns the number of properties updated.
 */
export async function syncTerminalsForPm(
  pmUserId: string,
  creds: MerchantCredentials
): Promise<{ terminalsFound: number; propertiesUpdated: number; terminalId: string | null }> {
  try {
    const terminals = await fetchMerchantTerminals(creds);

    if (terminals.length === 0) {
      console.warn(`[terminal-sync] No terminals found for PM ${pmUserId}`);
      return { terminalsFound: 0, propertiesUpdated: 0, terminalId: null };
    }

    console.log(
      `[terminal-sync] Found ${terminals.length} terminal(s) for PM ${pmUserId}:`,
      terminals.map((t) => ({ id: t.id, tid: t.tid, name: t.name }))
    );

    // Use the first terminal as the default
    const primaryTerminal = terminals[0];
    const terminalId = String(primaryTerminal.id);

    // Update the PM's default terminal ID
    await db.user.update({
      where: { id: pmUserId },
      data: { kadimaMerchantTerminalId: terminalId },
    });

    // Assign the terminal to all of the PM's properties that don't have one
    const result = await db.property.updateMany({
      where: {
        landlordId: pmUserId,
        kadimaTerminalId: null,
      },
      data: {
        kadimaTerminalId: terminalId,
      },
    });

    auditLog({
      action: "UPDATE",
      objectType: "TerminalSync",
      objectId: pmUserId,
      description: `Synced ${terminals.length} Kadima terminal(s). Primary: ${terminalId} (TID ${primaryTerminal.tid}). Updated ${result.count} properties.`,
      newValue: {
        terminals: terminals.map((t) => ({ id: t.id, tid: t.tid, name: t.name })),
        primaryTerminalId: terminalId,
        propertiesUpdated: result.count,
      },
    });

    console.log(
      `[terminal-sync] PM ${pmUserId}: terminal ${terminalId} assigned to ${result.count} properties`
    );

    return {
      terminalsFound: terminals.length,
      propertiesUpdated: result.count,
      terminalId,
    };
  } catch (error) {
    console.error(`[terminal-sync] Failed for PM ${pmUserId}:`, error);
    return { terminalsFound: 0, propertiesUpdated: 0, terminalId: null };
  }
}

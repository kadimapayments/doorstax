/**
 * NACHA SEC code mapping for Kadima ACH transactions.
 *
 * As of 2026-05-05 Kadima rejects ACH API calls without an `SECCode`
 * field. This module is the single source of truth for picking the
 * right code based on the authorisation context — every ACH call site
 * funnels through `pickSecCode()` so the choice is reviewable in one
 * place, not scattered across a dozen routes.
 *
 * SEC code definitions (NACHA):
 *
 *   WEB — Internet-Initiated Entry. Consumer authorises a debit via a
 *         web form (e.g. tenant clicks Pay Rent in the portal).
 *
 *   PPD — Prearranged Payment and Deposit. Standing written or
 *         electronic authorisation for recurring debits (autopay) or
 *         pre-authorised one-off back-office charges.
 *
 *   TEL — Telephone-Initiated Entry. Consumer authorises a debit
 *         verbally on the phone (e.g. PM keys in tenant's ACH details
 *         while on a support call — the virtual-terminal "phone-collected"
 *         flow).
 *
 *   CCD — Corporate Credit or Debit. Business-to-business transfers
 *         (owner payouts, vendor payouts).
 *
 * Wire format: send `SECCode: "WEB"` (capitalised key, uppercase value)
 * on the JSON body — that matches Kadima's published curl example.
 * Internal types use camelCase `secCode` per TS convention; the
 * Kadima wrappers translate at the boundary.
 */

export type AchSecCode = "WEB" | "PPD" | "TEL" | "CCD";

/**
 * The authorisation context for an ACH transaction. Every kind maps to
 * exactly one SEC code via `pickSecCode()`. New flows MUST add a new
 * `kind` here so the type-system forces a deliberate code choice.
 */
export type AchTransactionContext =
  /** Tenant typed ACH details into a web form (one-off rent payment). */
  | { kind: "tenant_web_inline" }
  /** Tenant clicked Pay against a previously-vaulted bank account
   *  through the web portal. The transaction itself is web-initiated. */
  | { kind: "tenant_web_vault" }
  /** Tenant enrolled in autopay; recurring schedule with standing
   *  electronic authorisation captured at enrollment. */
  | { kind: "tenant_autopay_recurring" }
  /** PM on the phone with a tenant, keying in ACH details. */
  | { kind: "pm_phone_collected" }
  /** PM-initiated charge against a vault account where standing
   *  written authorisation is on file. Use sparingly — if no standing
   *  PPD auth exists, this transaction risks an R10 ("not authorised")
   *  return. Confirm authorisation copy with legal before using. */
  | { kind: "pm_back_office_standing" }
  /** B2B credit from the merchant to an owner's bank account. */
  | { kind: "owner_payout" }
  /** B2B credit from the merchant to a vendor's bank account. */
  | { kind: "vendor_payout" };

/**
 * Resolve the NACHA SEC code for a given authorisation context.
 *
 * The exhaustive switch is deliberate — adding a new `kind` to
 * `AchTransactionContext` causes a TS error here until the mapping
 * is filled in. This is the safety net.
 */
export function pickSecCode(ctx: AchTransactionContext): AchSecCode {
  switch (ctx.kind) {
    case "tenant_web_inline":
    case "tenant_web_vault":
      return "WEB";
    case "tenant_autopay_recurring":
    case "pm_back_office_standing":
      return "PPD";
    case "pm_phone_collected":
      return "TEL";
    case "owner_payout":
    case "vendor_payout":
      return "CCD";
  }
}

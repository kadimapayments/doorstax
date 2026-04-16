/**
 * Commission configuration helpers for admin-invited agents.
 *
 * Admins can decide at invite time (and edit later) whether an agent earns
 * commissions, and optionally override the default tier-based kickback rates.
 *
 * Config lives on AgentProfile:
 *   commissionEnabled : bool  (default true)
 *   commissionMode    : "TIER_DEFAULT" | "CUSTOM_TIER"  (default TIER_DEFAULT)
 *   customTierRates   : { Starter, Growth, Scale, Enterprise } | null
 */

import { AGENT_KICKBACK_RATES } from "@/lib/residual-tiers";

export type CommissionMode = "TIER_DEFAULT" | "CUSTOM_TIER";

export interface CommissionConfig {
  commissionEnabled: boolean;
  commissionMode: CommissionMode;
  customTierRates: Record<string, number> | null;
}

/**
 * Validate + normalise an arbitrary request body into a CommissionConfig.
 * Used by the invite POST and the update-commission action.
 */
export function validateCommissionConfig(
  raw: unknown
):
  | { ok: true; config: CommissionConfig }
  | { ok: false; error: string } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = (raw ?? {}) as any;

  const commissionEnabled =
    body.commissionEnabled === undefined ? true : Boolean(body.commissionEnabled);

  const commissionMode: CommissionMode =
    body.commissionMode === "CUSTOM_TIER" ? "CUSTOM_TIER" : "TIER_DEFAULT";

  let customTierRates: Record<string, number> | null = null;

  if (commissionEnabled && commissionMode === "CUSTOM_TIER") {
    const provided = body.customTierRates;
    if (!provided || typeof provided !== "object") {
      return {
        ok: false,
        error: "customTierRates must be an object with all 4 tiers",
      };
    }
    const requiredTiers = Object.keys(AGENT_KICKBACK_RATES);
    const normalised: Record<string, number> = {};
    for (const tier of requiredTiers) {
      const v = Number((provided as Record<string, unknown>)[tier]);
      if (!Number.isFinite(v) || v < 0) {
        return {
          ok: false,
          error: `customTierRates.${tier} must be a non-negative number`,
        };
      }
      normalised[tier] = v;
    }
    customTierRates = normalised;
  }

  return {
    ok: true,
    config: { commissionEnabled, commissionMode, customTierRates },
  };
}

/**
 * Render the commission section of the agent invite email based on their
 * config. Returns an HTML string to drop into the email body.
 *
 * - Disabled → short paragraph ("referral tracking only")
 * - TIER_DEFAULT → standard kickback table
 * - CUSTOM_TIER → same table with custom numbers + footnote
 */
export function renderCommissionEmailBlock(config: CommissionConfig): string {
  if (!config.commissionEnabled) {
    return `<div class="highlight"><p style="margin:0;font-weight:600;">Referral tracking only</p><p style="margin:8px 0 0 0;font-size:13px;color:#666;">You'll be listed as a referring agent, but commissions are not enabled for your account. Reach out to the DoorStax team if you have questions about your arrangement.</p></div>`;
  }

  const rates =
    config.commissionMode === "CUSTOM_TIER" && config.customTierRates
      ? config.customTierRates
      : AGENT_KICKBACK_RATES;

  const row = (tier: string, units: string, rate: number, withBorder: boolean) =>
    `<tr${withBorder ? ' style="border-bottom:1px solid #f3f4f6;"' : ""}><td style="padding:8px 0;">${tier}</td><td style="padding:8px 0;color:#666;">${units}</td><td style="padding:8px 0;text-align:right;font-weight:600;">$${rate.toFixed(2)}/unit/mo</td></tr>`;

  const footnote =
    config.commissionMode === "CUSTOM_TIER"
      ? `<p style="margin:12px 0 0 0;font-size:12px;color:#666;font-style:italic;">These rates have been customized for your account.</p>`
      : `<p style="margin:12px 0 0 0;font-size:12px;color:#666;">Example: refer a 200-unit PM and earn $${(rates.Growth * 200).toFixed(0)}/month — every month they stay on DoorStax.</p>`;

  return `<div class="highlight"><p style="margin:0 0 12px 0;font-weight:600;">Your earnings scale with every PM you refer</p><p style="margin:0 0 12px 0;font-size:13px;color:#666;">Earn a flat per-unit kickback every month based on the PM's tier. As your referred PMs grow, your earnings grow with them.</p><table style="width:100%;border-collapse:collapse;"><thead><tr style="border-bottom:2px solid #e5e7eb;"><th style="text-align:left;padding:8px 0;font-size:12px;color:#666;">PM Tier</th><th style="text-align:left;padding:8px 0;font-size:12px;color:#666;">Units</th><th style="text-align:right;padding:8px 0;font-size:12px;color:#666;">Your Kickback</th></tr></thead><tbody>${row("Starter", "0–99", rates.Starter ?? 0, true)}${row("Growth", "100–499", rates.Growth ?? 0, true)}${row("Scale", "500–999", rates.Scale ?? 0, true)}${row("Enterprise", "1,000+", rates.Enterprise ?? 0, false)}</tbody></table>${footnote}</div>`;
}

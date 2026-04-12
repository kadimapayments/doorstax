import type { ResidualTier } from "./residual-tiers";

/**
 * Notify admins and the PM when a tier crossing is detected.
 * Called from unit create/delete routes after checkTierCrossing().
 */
export async function notifyTierCrossing(
  pmId: string,
  crossing: {
    previousTier: ResidualTier;
    newTier: ResidualTier;
    unitCount: number;
  }
): Promise<void> {
  const { db } = await import("@/lib/db");
  const { notify } = await import("@/lib/notifications");

  const pmUser = await db.user.findUnique({
    where: { id: pmId },
    select: { name: true, email: true, companyName: true },
  });
  if (!pmUser) return;

  const isUpgrade =
    crossing.newTier.minUnits > crossing.previousTier.minUnits;
  const pmLabel =
    pmUser.companyName || pmUser.name || pmUser.email || "PM";

  // ── Notify all ADMINs ────────────────────────────────────
  const admins = await db.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true, email: true },
  });

  for (const admin of admins) {
    await notify({
      userId: admin.id,
      createdById: pmId,
      type: "TIER_CHANGE",
      title: isUpgrade
        ? `PM Tier Upgrade: ${pmLabel} \u2192 ${crossing.newTier.name}`
        : `PM Tier Downgrade: ${pmLabel} \u2192 ${crossing.newTier.name}`,
      message: `${pmLabel} now has ${crossing.unitCount} units. New tier: ${crossing.newTier.name}. ` +
        `Kadima campaign rates: Card ${(crossing.newTier.platformCardRate * 100).toFixed(2)}%, ` +
        `ACH platform cost $${crossing.newTier.platformAchCost.toFixed(2)}.`,
      severity: "warning",
      actionUrl: "/admin/merchants",
    }).catch(console.error);
  }

  // ── Notify the PM (upgrades only) ────────────────────────
  if (isUpgrade) {
    const isMonetizationUnlock =
      crossing.previousTier.feeScheduleLocked &&
      !crossing.newTier.feeScheduleLocked;

    const pmTitle = isMonetizationUnlock
      ? "\ud83c\udf89 Monetization Unlocked!"
      : `\ud83c\udf89 ${crossing.newTier.name} Tier Reached!`;

    const pmMessage = isMonetizationUnlock
      ? `Congratulations! You\u2019ve reached ${crossing.unitCount} units. You can now customize your fee schedule, set your own ACH rates, choose who pays, and earn on every card and ACH transaction.`
      : `You\u2019ve reached ${crossing.unitCount} units. Your platform ACH cost drops to $${crossing.newTier.platformAchCost.toFixed(2)} and card earnings increase to ${(crossing.newTier.cardRate * 100).toFixed(2)}%.`;

    await notify({
      userId: pmId,
      createdById: pmId,
      type: "TIER_UPGRADE",
      title: pmTitle,
      message: pmMessage,
      severity: "info",
      actionUrl: isMonetizationUnlock
        ? "/dashboard/fee-schedules"
        : "/dashboard/residuals",
    }).catch(console.error);

    // Email the PM
    if (pmUser.email) {
      try {
        const { getResend } = await import("@/lib/email");
        const { emailStyles, emailHeader, emailFooter, emailButton, esc } =
          await import("@/lib/emails/_layout");

        const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${emailStyles(`
    .tier-card { background: linear-gradient(135deg, #5B00FF 0%, #7C3AFF 100%); border-radius: 10px; padding: 20px; margin: 20px 0; text-align: center; }
    .tier-card h3 { color: #ffffff; font-size: 22px; margin: 0 0 4px; font-weight: 700; }
    .tier-card p { color: rgba(255,255,255,0.85); font-size: 14px; margin: 0; }
    .rate-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    .rate-table td { padding: 8px 0; font-size: 13px; color: #555; border-bottom: 1px solid #eee; }
    .rate-table td:last-child { text-align: right; font-weight: 600; color: #333; }
    `)}
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${emailHeader()}
      <h1>${isMonetizationUnlock ? "\ud83c\udf89 Monetization Unlocked!" : `\ud83c\udf89 ${esc(crossing.newTier.name)} Tier Reached!`}</h1>
      <p>Hi ${esc(pmUser.name || "there")},</p>
      <div class="tier-card">
        <h3>${esc(crossing.newTier.name)} Tier</h3>
        <p>${crossing.unitCount} units</p>
      </div>
      <table class="rate-table">
        <tr><td>ACH Platform Cost</td><td>$${crossing.newTier.platformAchCost.toFixed(2)}/transaction</td></tr>
        <tr><td>Card Earnings</td><td>${(crossing.newTier.cardRate * 100).toFixed(2)}%</td></tr>
        <tr><td>Subscription Rate</td><td>$${crossing.newTier.perUnitCost.toFixed(2)}/unit</td></tr>
      </table>
      ${isMonetizationUnlock
        ? "<p>You can now set your own ACH rates, choose who pays (tenant, owner, or you), and earn on every transaction.</p>"
        : "<p>Your platform costs have decreased and your card earnings have increased.</p>"}
      ${emailButton(isMonetizationUnlock ? "Set Up Fee Schedule" : "View Earnings", isMonetizationUnlock ? "https://doorstax.com/dashboard/fee-schedules" : "https://doorstax.com/dashboard/residuals")}
    </div>
    ${emailFooter()}
  </div>
</body>
</html>`.trim();

        await getResend().emails.send({
          from: "DoorStax <noreply@doorstax.com>",
          to: pmUser.email,
          subject: isMonetizationUnlock
            ? "\ud83c\udf89 Monetization Unlocked \u2014 DoorStax"
            : `${crossing.newTier.name} Tier Reached \u2014 DoorStax`,
          html,
        });
      } catch (err) {
        console.error("[tier-notifications] Email failed:", err);
      }
    }
  }
}

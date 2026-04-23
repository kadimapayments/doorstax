import { emailStyles, emailHeader, emailFooter, emailButton } from "./_layout";
import { getResend } from "@/lib/email";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com";

export interface RentAdjustmentEmailOpts {
  tenantName: string;
  propertyName: string;
  unitNumber: string;
  previousAmount: number;
  newAmount: number;
  changePercent: number;
  effectiveDate: Date;
  reason?: string | null;
  pmName?: string | null;
  pmEmail?: string | null;
}

function money(n: number): string {
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function rentAdjustmentHtml(opts: RentAdjustmentEmailOpts): string {
  const {
    tenantName,
    propertyName,
    unitNumber,
    previousAmount,
    newAmount,
    changePercent,
    effectiveDate,
    reason,
    pmName,
    pmEmail,
  } = opts;

  const isIncrease = newAmount > previousAmount;
  const pctLabel =
    (changePercent >= 0 ? "+" : "") + changePercent.toFixed(1) + "%";
  const dateLabel = effectiveDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${emailStyles(`
    .rent-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; font-size: 14px; }
    .rent-row:last-child { border-bottom: 0; }
    .rent-label { color: #666; }
    .rent-value { color: #111; font-weight: 600; font-variant-numeric: tabular-nums; }
    .delta-up { color: #b45309; }
    .delta-down { color: #047857; }
    `)}
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${emailHeader()}
      <h1>Rent Adjustment Notice</h1>
      <p>Hi ${tenantName},</p>
      <p>
        This is a formal notice that the monthly rent for your unit at
        <strong>${propertyName} — Unit ${unitNumber}</strong> will be
        adjusted as follows:
      </p>

      <div class="highlight" style="padding: 16px;">
        <div class="rent-row">
          <span class="rent-label">Current rent</span>
          <span class="rent-value">${money(previousAmount)}</span>
        </div>
        <div class="rent-row">
          <span class="rent-label">New rent</span>
          <span class="rent-value">${money(newAmount)}</span>
        </div>
        <div class="rent-row">
          <span class="rent-label">Change</span>
          <span class="rent-value ${isIncrease ? "delta-up" : "delta-down"}">${pctLabel}</span>
        </div>
        <div class="rent-row">
          <span class="rent-label">Effective date</span>
          <span class="rent-value">${dateLabel}</span>
        </div>
      </div>

      ${
        reason
          ? `<p><strong>Reason:</strong> ${reason}</p>`
          : ""
      }

      <p>
        If you have any questions about this change, please contact
        ${pmName ? `<strong>${pmName}</strong>` : "your property manager"}${
          pmEmail ? ` at <a href="mailto:${pmEmail}">${pmEmail}</a>` : ""
        }.
      </p>

      ${emailButton("View your account", `${BASE_URL}/tenant`)}

      <p style="font-size: 12px; color: #888; margin-top: 24px;">
        This notice is being sent in accordance with your lease agreement
        and applicable local laws. Please retain for your records.
      </p>
    </div>
    ${emailFooter()}
  </div>
</body>
</html>`.trim();
}

/**
 * Fire-and-forget email sender. Catches errors internally — callers
 * should not await the full send in a transaction-critical path.
 */
export async function sendRentAdjustmentEmail(
  to: string,
  opts: RentAdjustmentEmailOpts
): Promise<void> {
  try {
    await getResend().emails.send({
      from: "DoorStax <noreply@doorstax.com>",
      to,
      subject: `Rent Adjustment Notice — ${opts.propertyName}`,
      html: rentAdjustmentHtml(opts),
    });
  } catch (err) {
    console.error("[rent-adjustment] email failed:", err);
  }
}

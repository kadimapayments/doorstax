/**
 * On-time payment evaluation for recovery plans.
 *
 * A "required payment" in a recovery plan maps to a single billing period
 * (YYYY-MM). That period has a due date (unit.dueDay) and a grace window
 * (plan.graceDays). A payment counts as on-time if:
 *
 *   1. It was COMPLETED successfully (not FAILED, not PENDING).
 *   2. It belongs to the tenant the plan covers.
 *   3. `paidAt` falls within [periodStart, dueDate + graceDays].
 *
 * Edge cases we handle explicitly:
 *   - Payments with null `paidAt` — treated as not-yet-landed (return false).
 *   - Payments made BEFORE the period starts (early rent) — still count for
 *     the period they were earmarked for (`dueDate` field on Payment).
 *   - Late-but-recoverable payments (within grace) — count as on-time AND
 *     trigger a status sweep out of PLAN_AT_RISK back into PLAN_ACTIVE.
 */

export interface PeriodWindow {
  periodKey: string; // "YYYY-MM"
  periodStart: Date; // midnight on 1st of the period
  dueDate: Date; // dueDay of the period (typically 1st)
  graceEnd: Date; // dueDate + graceDays inclusive end of on-time window
}

/**
 * Build the list of required periods for a plan starting at `startDate`.
 *
 * `requiredPayments` consecutive monthly periods, starting with the month
 * of `startDate` (so a plan that starts March 3rd covers March, April, May
 * if requiredPayments=3). `dueDay` comes from the unit and is the day of
 * the month rent is due (default 1 per current Unit schema).
 */
export function buildRequiredPeriods(
  startDate: Date,
  requiredPayments: number,
  dueDay: number,
  graceDays: number
): PeriodWindow[] {
  const periods: PeriodWindow[] = [];
  const baseYear = startDate.getUTCFullYear();
  const baseMonth = startDate.getUTCMonth();

  for (let i = 0; i < requiredPayments; i++) {
    const year = baseYear + Math.floor((baseMonth + i) / 12);
    const month = (baseMonth + i) % 12;
    const periodStart = new Date(Date.UTC(year, month, 1));
    const dueDate = new Date(Date.UTC(year, month, dueDay));
    const graceEnd = new Date(dueDate);
    graceEnd.setUTCDate(graceEnd.getUTCDate() + graceDays);
    graceEnd.setUTCHours(23, 59, 59, 999);
    periods.push({
      periodKey: `${year}-${String(month + 1).padStart(2, "0")}`,
      periodStart,
      dueDate,
      graceEnd,
    });
  }
  return periods;
}

/**
 * Convert a date into a period key ("YYYY-MM") for comparison against the
 * plan's `requiredPeriodKeys` snapshot.
 */
export function periodKeyFor(d: Date): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export interface OnTimeEvaluation {
  wasOnTime: boolean;
  /** `true` if paid AT ALL (vs. period closed with nothing) — used to
   *  distinguish MISSED (no payment) from FAILED (late past grace). */
  wasPaid: boolean;
  /** Days late past the due date. Negative = paid early, 0 = on due day. */
  daysLate: number;
}

/**
 * Evaluate whether a single completed payment satisfies a period's on-time
 * requirement.
 *
 * Inputs:
 *   - `paidAt` — the Payment.paidAt timestamp (must not be null)
 *   - `period` — the PeriodWindow we're evaluating against
 */
export function evaluatePayment(
  paidAt: Date,
  period: PeriodWindow
): OnTimeEvaluation {
  const paidTime = paidAt.getTime();
  const dueTime = period.dueDate.getTime();
  const graceEndTime = period.graceEnd.getTime();
  const daysLate = Math.ceil((paidTime - dueTime) / (24 * 60 * 60 * 1000));
  return {
    wasPaid: true,
    wasOnTime: paidTime <= graceEndTime,
    daysLate,
  };
}

/**
 * Pick the period this payment should be credited to. Uses the payment's
 * `dueDate` field first (the tenant/PM explicitly earmarked the period);
 * falls back to `paidAt`'s calendar month.
 *
 * Returns null when the resolved period isn't in the plan's required list
 * — those payments are ignored for plan tracking (they may be unrelated
 * charges like fees).
 */
export function resolvePaymentPeriod(
  payment: { dueDate: Date | null; paidAt: Date | null; type: string },
  requiredPeriodKeys: string[]
): string | null {
  // Only RENT payments are candidates for recovery tracking. Fees,
  // deposits, application charges etc. don't count toward the required
  // monthly on-time streak.
  if (payment.type !== "RENT") return null;

  const anchor = payment.dueDate || payment.paidAt;
  if (!anchor) return null;

  const key = periodKeyFor(anchor);
  return requiredPeriodKeys.includes(key) ? key : null;
}

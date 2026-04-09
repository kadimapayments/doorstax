import { db } from "@/lib/db";

/**
 * Trust account status — verifies trust bank balance matches liabilities.
 * Trust bank should equal: security deposits + owner funds payable + prepaid rent.
 */
export async function getTrustAccountStatus(pmId: string) {
  const [trustBank, depositsHeld, ownerPayable, prepaidRent] =
    await Promise.all([
      db.ledgerAccount.findFirst({
        where: { pmId, code: "1010" },
        select: { currentBalance: true },
      }),
      db.ledgerAccount.findFirst({
        where: { pmId, code: "2100" },
        select: { currentBalance: true },
      }),
      db.ledgerAccount.findFirst({
        where: { pmId, code: "2200" },
        select: { currentBalance: true },
      }),
      db.ledgerAccount.findFirst({
        where: { pmId, code: "2300" },
        select: { currentBalance: true },
      }),
    ]);

  const trustBankBalance = trustBank?.currentBalance || 0;
  const securityDepositsHeld = depositsHeld?.currentBalance || 0;
  const ownerFundsPayable = ownerPayable?.currentBalance || 0;
  const tenantPrepaidRent = prepaidRent?.currentBalance || 0;
  const totalLiabilities =
    securityDepositsHeld + ownerFundsPayable + tenantPrepaidRent;

  return {
    trustBankBalance,
    securityDepositsHeld,
    ownerFundsPayable,
    tenantPrepaidRent,
    totalLiabilities,
    isInBalance: Math.abs(trustBankBalance - totalLiabilities) < 0.01,
    variance: trustBankBalance - totalLiabilities,
  };
}

import { db } from "@/lib/db";
import type { ScreeningOptions } from "./client";

/**
 * Resolve screening config for a unit using cascade:
 * Unit overrides -> PM defaults -> system defaults
 */
export async function resolveScreeningConfig(
  unitId: string,
  pmUserId: string
): Promise<ScreeningOptions> {
  const unit = await db.unit.findUnique({
    where: { id: unitId },
    select: {
      screeningCreditReport: true,
      screeningCriminal: true,
      screeningEviction: true,
      screeningApplication: true,
      screeningPayerType: true,
    },
  });

  const pm = await db.user.findUnique({
    where: { id: pmUserId },
    select: {
      screeningCreditReport: true,
      screeningCriminal: true,
      screeningEviction: true,
      screeningApplication: true,
      screeningPayerType: true,
    },
  });

  const creditReport =
    unit?.screeningCreditReport ?? pm?.screeningCreditReport ?? true;
  const criminal =
    unit?.screeningCriminal ?? pm?.screeningCriminal ?? true;
  const eviction =
    unit?.screeningEviction ?? pm?.screeningEviction ?? true;
  const application =
    unit?.screeningApplication ?? pm?.screeningApplication ?? true;
  const payerType = (unit?.screeningPayerType ??
    pm?.screeningPayerType ??
    "landlord") as "landlord" | "renter";

  // Enforce: criminal/eviction require creditReport; if no credit, application must be true
  return {
    creditReport,
    criminal: creditReport ? criminal : false,
    eviction: creditReport ? eviction : false,
    application: creditReport ? application : true,
    payerType,
  };
}

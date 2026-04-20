import { db } from "@/lib/db";

/**
 * Soft-gate check for property underwriter review.
 *
 * A property is live (card/ACH charges allowed, terminal assignable,
 * tenants can vault a payment method against it) only when its
 * `boardingStatus` is "APPROVED". Anything else — "PENDING_REVIEW",
 * "REJECTED", "NEEDS_INFO" — is a block.
 *
 * Rationale: every new property adds a terminal to the PM's Kadima
 * merchant account AND increases that merchant's monthly processing
 * volume, both of which are changes a risk team wants eyes on before
 * any real money moves. This guard is the enforcement layer; the
 * admin review queue is the unblock mechanism.
 *
 * Existing (legacy) rows default to "APPROVED" at the schema level,
 * so pre-existing properties keep working without migration cleanup.
 */

export type PropertyGuardResult =
  | { ok: true; propertyId: string; boardingStatus: "APPROVED" }
  | {
      ok: false;
      reason: string;
      propertyId: string;
      boardingStatus: string;
    };

const BLOCK_MESSAGES: Record<string, string> = {
  PENDING_REVIEW:
    "This property is pending underwriter review — live payments are blocked until an admin approves it.",
  NEEDS_INFO:
    "The underwriter has asked for more information on this property. Check the property page and respond before live payments can run.",
  REJECTED:
    "This property was rejected by the underwriter. Live payments cannot run against it. Contact DoorStax support.",
};

/**
 * Fetch the property's boarding status and return a pass/fail result.
 *
 * Callers should return a 403 with the returned `reason` when `ok === false`.
 */
export async function assertPropertyApproved(
  propertyId: string
): Promise<PropertyGuardResult> {
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: { id: true, boardingStatus: true },
  });

  if (!property) {
    return {
      ok: false,
      reason: "Property not found",
      propertyId,
      boardingStatus: "NOT_FOUND",
    };
  }

  if (property.boardingStatus === "APPROVED") {
    return { ok: true, propertyId: property.id, boardingStatus: "APPROVED" };
  }

  return {
    ok: false,
    reason:
      BLOCK_MESSAGES[property.boardingStatus] ||
      `Property is in ${property.boardingStatus} state — live payments blocked`,
    propertyId: property.id,
    boardingStatus: property.boardingStatus,
  };
}

/**
 * Convenience variant when you have a unit ID but no property ID.
 * Looks up the unit's property, then runs the standard gate.
 */
export async function assertUnitPropertyApproved(
  unitId: string
): Promise<PropertyGuardResult> {
  const unit = await db.unit.findUnique({
    where: { id: unitId },
    select: { id: true, propertyId: true },
  });
  if (!unit) {
    return {
      ok: false,
      reason: "Unit not found",
      propertyId: "",
      boardingStatus: "NOT_FOUND",
    };
  }
  return assertPropertyApproved(unit.propertyId);
}

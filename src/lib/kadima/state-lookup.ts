/**
 * Kadima US State ID Lookup
 *
 * Maps US state abbreviations to Kadima's internal state IDs.
 * Source: GET https://kadimadashboard.com/api/country/199/states
 * Country ID 199 = United States
 *
 * This is a static map — Kadima state IDs do not change.
 */

const STATE_CODE_TO_ID: Record<string, number> = {
  AL: 1,
  AK: 2,
  AZ: 3,
  AR: 4,
  CA: 5,
  CO: 6,
  CT: 7,
  DE: 8,
  DC: 9,
  FL: 10,
  GA: 11,
  HI: 12,
  ID: 13,
  IL: 14,
  IN: 15,
  IA: 16,
  KS: 17,
  KY: 18,
  LA: 19,
  ME: 20,
  MD: 21,
  MA: 22,
  MI: 23,
  MN: 24,
  MS: 25,
  MO: 26,
  MT: 27,
  NE: 28,
  NV: 29,
  NH: 30,
  NJ: 31,
  NM: 32,
  NY: 33,
  NC: 34,
  ND: 35,
  OH: 36,
  OK: 37,
  OR: 38,
  PA: 39,
  RI: 40,
  SC: 41,
  SD: 42,
  TN: 43,
  TX: 44,
  UT: 45,
  VT: 46,
  VA: 47,
  WA: 48,
  WV: 49,
  WI: 50,
  WY: 51,
  // US Territories
  AS: 52, // American Samoa
  GU: 53, // Guam
  MP: 54, // Northern Mariana Islands
  PR: 55, // Puerto Rico
  VI: 56, // US Virgin Islands
};

/** US country ID in Kadima */
export const KADIMA_US_COUNTRY_ID = 199;

/**
 * Convert a US state abbreviation (e.g., "CA") to Kadima's state ID (e.g., 5).
 * Returns null if the abbreviation is not recognized.
 */
export function getKadimaStateId(stateCode: string | null | undefined): number | null {
  if (!stateCode) return null;
  const normalized = stateCode.trim().toUpperCase();
  return STATE_CODE_TO_ID[normalized] ?? null;
}

/**
 * Build a Kadima-compatible address object with state.id and country.id.
 * Used in boarding application sync.
 */
export function buildKadimaAddress(address: {
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}): Record<string, unknown> | undefined {
  // Only include if we have at least one field
  if (!address.street && !address.city && !address.state && !address.zip) {
    return undefined;
  }

  const stateId = getKadimaStateId(address.state);

  return {
    ...(address.street ? { street: address.street } : {}),
    ...(address.city ? { city: address.city } : {}),
    ...(address.zip ? { zip: address.zip } : {}),
    ...(stateId ? { state: { id: stateId } } : {}),
    country: { id: KADIMA_US_COUNTRY_ID },
  };
}

import { z } from "zod";

export const propertyTypeEnum = z.enum([
  "SINGLE_FAMILY",
  "MULTIFAMILY",
  "OFFICE",
  "COMMERCIAL",
]);

export const constructionTypeEnum = z.enum([
  "BRICK",
  "WOOD_FRAME",
  "CONCRETE",
  "MIXED",
]);

export const parkingTypeEnum = z.enum([
  "STREET",
  "ONSITE",
  "COVERED",
  "GARAGE",
  "MIXED",
]);

export const createPropertySchema = z.object({
  // ─── Address / basics ───────────────────────────────
  name: z.string().min(1, "Property name is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zip: z.string().min(5, "ZIP code is required"),
  propertyType: propertyTypeEnum.default("MULTIFAMILY"),
  description: z.string().optional(),
  kadimaTerminalId: z.string().optional(),
  photos: z.array(z.string()).default([]),
  purchasePrice: z.coerce.number().min(0).optional(),
  purchaseDate: z.string().optional(),
  ownerId: z.string().nullable().optional(),
  feeScheduleId: z.string().nullable().optional(),
  applicationTemplateId: z.string().nullable().optional(),

  // ─── Building profile (underwriter intake) ──────────
  // All optional — existing callers keep working; the wizard
  // enforces its own per-step requirements via propertyOnboarding*Schema.
  yearBuilt: z.coerce.number().int().min(1700).max(2100).optional(),
  totalSqft: z.coerce.number().int().min(0).optional(),
  storyCount: z.coerce.number().int().min(1).max(500).optional(),
  hasElevator: z.boolean().optional(),
  constructionType: constructionTypeEnum.optional(),
  parkingSpaces: z.coerce.number().int().min(0).optional(),
  parkingType: parkingTypeEnum.optional(),
  hasOnsiteLaundry: z.boolean().optional(),

  // Unit mix (summary)
  residentialUnitCount: z.coerce.number().int().min(0).optional(),
  commercialUnitCount: z.coerce.number().int().min(0).optional(),
  commercialFloors: z.string().optional(), // CSV, e.g. "1,2"
  section8UnitCount: z.coerce.number().int().min(0).optional(),

  // Financial / compliance
  annualPropertyTax: z.coerce.number().min(0).optional(),
  expectedMonthlyRentRoll: z.coerce.number().min(0).optional(),
  mortgageHolder: z.string().optional(),
  insuranceCarrier: z.string().optional(),
  insurancePolicyNumber: z.string().optional(),
  parcelNumber: z.string().optional(),
  zoning: z.string().optional(),
});

export const updatePropertySchema = createPropertySchema.partial();

export const createUnitSchema = z.object({
  unitNumber: z.string().min(1, "Unit number is required"),
  bedrooms: z.coerce.number().int().min(0).optional(),
  bathrooms: z.coerce.number().min(0).optional(),
  sqft: z.coerce.number().int().min(0).optional(),
  parkingSpaces: z.coerce.number().int().min(0).optional(),
  rentAmount: z.coerce.number().min(0, "Rent amount is required"),
  dueDay: z.coerce.number().int().min(1).max(28).default(1),
  description: z.string().optional(),
  amenities: z.array(z.string()).default([]),
  photos: z.array(z.string()).default([]),
});

export const updateUnitSchema = createUnitSchema.partial().extend({
  // Listing toggles
  listingEnabled: z.boolean().optional(),
  applicationsEnabled: z.boolean().optional(),
  // Application template assignment
  applicationTemplateId: z.string().nullable().optional(),
  // RentSpree screening overrides
  screeningCreditReport: z.boolean().optional(),
  screeningCriminal: z.boolean().optional(),
  screeningEviction: z.boolean().optional(),
  screeningApplication: z.boolean().optional(),
  screeningPayerType: z.string().optional(),
});

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;

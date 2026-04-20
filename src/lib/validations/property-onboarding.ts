import { z } from "zod";
import {
  propertyTypeEnum,
  constructionTypeEnum,
  parkingTypeEnum,
} from "./property";

/**
 * Per-step validation for the /dashboard/properties/new wizard.
 *
 * The wizard is a 6-step intake — each step has its own schema so users
 * can move forward only when the current section is coherent. The final
 * submit uses `propertyOnboardingSubmitSchema`, which is the union of
 * all step fields.
 *
 * Field-level rules:
 * - Required: the things we absolutely need for an underwriter to sign
 *   off (address, owner, a minimum building profile).
 * - Optional: extras the PM can leave blank (parcel #, mortgage holder,
 *   certain doc types). The PDF just leaves those rows empty.
 */

// ─── Step 1 — Basics ──────────────────────────────────
export const propertyOnboardingStep1Schema = z.object({
  name: z.string().trim().min(1, "Property name is required"),
  address: z.string().trim().min(1, "Address is required"),
  city: z.string().trim().min(1, "City is required"),
  state: z.string().trim().min(2, "State is required"),
  zip: z.string().trim().min(5, "ZIP code is required"),
  propertyType: propertyTypeEnum,
  description: z.string().optional(),
  purchasePrice: z.coerce.number().min(0).optional(),
  purchaseDate: z.string().optional(),
  photos: z.array(z.string()).default([]),
});

// ─── Step 2 — Building profile ────────────────────────
export const propertyOnboardingStep2Schema = z.object({
  yearBuilt: z.coerce
    .number()
    .int()
    .min(1700, "Year built looks wrong")
    .max(new Date().getFullYear() + 5, "Year built is in the future"),
  totalSqft: z.coerce.number().int().min(1, "Total sqft is required"),
  storyCount: z.coerce
    .number()
    .int()
    .min(1, "At least 1 story")
    .max(500),
  hasElevator: z.boolean(),
  constructionType: constructionTypeEnum,
  parkingSpaces: z.coerce.number().int().min(0),
  parkingType: parkingTypeEnum,
  hasOnsiteLaundry: z.boolean(),
});

// ─── Step 3 — Unit mix & compliance ───────────────────
export const propertyOnboardingStep3Schema = z
  .object({
    residentialUnitCount: z.coerce
      .number()
      .int()
      .min(0, "Enter 0 if there are no residential units"),
    commercialUnitCount: z.coerce.number().int().min(0).default(0),
    commercialFloors: z.string().optional(),
    section8UnitCount: z.coerce.number().int().min(0).default(0),
    zoning: z.string().optional(),
    parcelNumber: z.string().optional(),
    annualPropertyTax: z.coerce.number().min(0).optional(),
  })
  .refine(
    (v) => v.residentialUnitCount + v.commercialUnitCount > 0,
    { message: "At least one unit (residential or commercial) is required", path: ["residentialUnitCount"] }
  )
  .refine(
    (v) => v.section8UnitCount <= v.residentialUnitCount,
    { message: "Section 8 count can't exceed residential unit count", path: ["section8UnitCount"] }
  );

// ─── Step 4 — Owner & finance ─────────────────────────
export const propertyOnboardingStep4Schema = z.object({
  ownerId: z.string().min(1, "Pick an owner or add a new one"),
  expectedMonthlyRentRoll: z.coerce.number().min(0).optional(),
  mortgageHolder: z.string().optional(),
  insuranceCarrier: z.string().optional(),
  insurancePolicyNumber: z.string().optional(),
});

// ─── Step 5 — Documents ───────────────────────────────
// Documents are uploaded directly to /api/properties/[id]/documents as
// they're dropped; this schema only validates that the user acknowledged
// the step (i.e. checked "I have nothing else to upload" if empty, or
// that at least one document is present). The real per-file validation
// happens server-side.
export const propertyOnboardingStep5Schema = z.object({
  documentIds: z.array(z.string()).default([]),
  acknowledgedNoDocuments: z.boolean().default(false),
});

// ─── Submit (everything) ──────────────────────────────
// Used by the POST handler to validate the complete payload on submit.
// Merges step 1-4; step 5 (documents) is already on disk by this point.
export const propertyOnboardingSubmitSchema = z
  .object({})
  .merge(propertyOnboardingStep1Schema)
  .merge(propertyOnboardingStep2Schema)
  .merge(propertyOnboardingStep4Schema)
  .extend({
    // Step 3 fields, inline (can't .merge a refined schema cleanly)
    residentialUnitCount: z.coerce.number().int().min(0),
    commercialUnitCount: z.coerce.number().int().min(0).default(0),
    commercialFloors: z.string().optional(),
    section8UnitCount: z.coerce.number().int().min(0).default(0),
    zoning: z.string().optional(),
    parcelNumber: z.string().optional(),
    annualPropertyTax: z.coerce.number().min(0).optional(),
  });

export type PropertyOnboardingStep1 = z.infer<
  typeof propertyOnboardingStep1Schema
>;
export type PropertyOnboardingStep2 = z.infer<
  typeof propertyOnboardingStep2Schema
>;
export type PropertyOnboardingStep3 = z.infer<
  typeof propertyOnboardingStep3Schema
>;
export type PropertyOnboardingStep4 = z.infer<
  typeof propertyOnboardingStep4Schema
>;
export type PropertyOnboardingStep5 = z.infer<
  typeof propertyOnboardingStep5Schema
>;
export type PropertyOnboardingSubmit = z.infer<
  typeof propertyOnboardingSubmitSchema
>;

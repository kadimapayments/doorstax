"use client";

import type { PropertyDocumentRecord } from "@/components/ui/document-upload";

/**
 * Shared state shape for the /dashboard/properties/new wizard.
 *
 * Lives in a React provider so each step can read/update its slice
 * without drilling props. Persisted to sessionStorage on every change
 * so a page refresh doesn't blow away a half-finished intake.
 *
 * Documents are a special case: they're uploaded to Vercel Blob + a
 * PropertyDocument row as soon as the PM drops them in (we need a
 * real property id to own them). The wizard writes them to step-5
 * state so the review screen can show what's been uploaded.
 */

export type PropertyType =
  | "SINGLE_FAMILY"
  | "MULTIFAMILY"
  | "OFFICE"
  | "COMMERCIAL";

export type ConstructionType = "BRICK" | "WOOD_FRAME" | "CONCRETE" | "MIXED";

export type ParkingType =
  | "STREET"
  | "ONSITE"
  | "COVERED"
  | "GARAGE"
  | "MIXED";

export interface WizardState {
  // ── Step 1: basics
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  propertyType: PropertyType;
  description: string;
  purchasePrice: string;
  purchaseDate: string;
  photos: string[];

  // ── Step 2: building
  yearBuilt: string;
  totalSqft: string;
  storyCount: string;
  hasElevator: boolean | null;
  constructionType: ConstructionType | "";
  parkingSpaces: string;
  parkingType: ParkingType | "";
  hasOnsiteLaundry: boolean | null;

  // ── Step 3: mix & compliance
  residentialUnitCount: string;
  commercialUnitCount: string;
  commercialFloors: string;
  section8UnitCount: string;
  zoning: string;
  parcelNumber: string;
  annualPropertyTax: string;

  // ── Step 4: owner & finance
  ownerId: string;
  expectedMonthlyRentRoll: string;
  mortgageHolder: string;
  insuranceCarrier: string;
  insurancePolicyNumber: string;

  // ── Step 5: documents (populated AFTER property is created on submit;
  //           we upload docs attached to the real propertyId)
  documents: PropertyDocumentRecord[];
  acknowledgedNoDocuments: boolean;

  // ── Runtime metadata
  createdPropertyId: string | null;
}

export const initialWizardState: WizardState = {
  name: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  propertyType: "MULTIFAMILY",
  description: "",
  purchasePrice: "",
  purchaseDate: "",
  photos: [],

  yearBuilt: "",
  totalSqft: "",
  storyCount: "",
  hasElevator: null,
  constructionType: "",
  parkingSpaces: "",
  parkingType: "",
  hasOnsiteLaundry: null,

  residentialUnitCount: "",
  commercialUnitCount: "",
  commercialFloors: "",
  section8UnitCount: "",
  zoning: "",
  parcelNumber: "",
  annualPropertyTax: "",

  ownerId: "",
  expectedMonthlyRentRoll: "",
  mortgageHolder: "",
  insuranceCarrier: "",
  insurancePolicyNumber: "",

  documents: [],
  acknowledgedNoDocuments: false,

  createdPropertyId: null,
};

export const DRAFT_KEY = "property-onboarding-draft";

export function loadDraft(): WizardState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { ...initialWizardState, ...parsed };
  } catch {
    return null;
  }
}

export function saveDraft(state: WizardState): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

/**
 * Map wizard state → POST /api/properties body.
 */
export function buildSubmitPayload(
  state: WizardState
): Record<string, unknown> {
  const numOrUndef = (s: string) => (s.trim() ? Number(s) : undefined);
  const strOrUndef = (s: string) => (s.trim() ? s.trim() : undefined);
  const boolOrUndef = (b: boolean | null) => (b === null ? undefined : b);

  return {
    // Step 1
    name: state.name.trim(),
    address: state.address.trim(),
    city: state.city.trim(),
    state: state.state.trim(),
    zip: state.zip.trim(),
    propertyType: state.propertyType,
    description: strOrUndef(state.description),
    purchasePrice: numOrUndef(state.purchasePrice),
    purchaseDate: strOrUndef(state.purchaseDate),
    photos: state.photos,
    // Step 2
    yearBuilt: numOrUndef(state.yearBuilt),
    totalSqft: numOrUndef(state.totalSqft),
    storyCount: numOrUndef(state.storyCount),
    hasElevator: boolOrUndef(state.hasElevator),
    constructionType: state.constructionType || undefined,
    parkingSpaces: numOrUndef(state.parkingSpaces),
    parkingType: state.parkingType || undefined,
    hasOnsiteLaundry: boolOrUndef(state.hasOnsiteLaundry),
    // Step 3
    residentialUnitCount: numOrUndef(state.residentialUnitCount),
    commercialUnitCount: numOrUndef(state.commercialUnitCount),
    commercialFloors: strOrUndef(state.commercialFloors),
    section8UnitCount: numOrUndef(state.section8UnitCount),
    zoning: strOrUndef(state.zoning),
    parcelNumber: strOrUndef(state.parcelNumber),
    annualPropertyTax: numOrUndef(state.annualPropertyTax),
    // Step 4
    ownerId: state.ownerId || undefined,
    expectedMonthlyRentRoll: numOrUndef(state.expectedMonthlyRentRoll),
    mortgageHolder: strOrUndef(state.mortgageHolder),
    insuranceCarrier: strOrUndef(state.insuranceCarrier),
    insurancePolicyNumber: strOrUndef(state.insurancePolicyNumber),
  };
}

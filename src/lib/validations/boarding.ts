import { z } from "zod";

export const boardingStep1Schema = z.object({
  businessLegalName: z.string().min(1, "Business legal name is required"),
  dba: z.string().optional(),
  businessType: z.string().min(1, "Business type is required"),
  ein: z.string().optional(),
});

export const boardingStep2Schema = z.object({
  businessAddress: z.string().min(1, "Address is required"),
  businessCity: z.string().min(1, "City is required"),
  businessState: z.string().min(1, "State is required"),
  businessZip: z.string().min(5, "ZIP is required"),
  businessPhone: z.string().min(1, "Phone is required"),
  businessEmail: z.string().email("Valid email required"),
  websiteUrl: z.string().optional(),
});

export const boardingStep3Schema = z.object({
  principalFirstName: z.string().min(1, "First name is required"),
  principalLastName: z.string().min(1, "Last name is required"),
  principalTitle: z.string().optional(),
  principalDob: z.string().optional(),
  principalSsn: z.string().optional(),
  principalAddress: z.string().optional(),
  principalCity: z.string().optional(),
  principalState: z.string().optional(),
  principalZip: z.string().optional(),
  ownershipPercent: z.coerce.number().int().min(0).max(100).optional(),
});

export const boardingStep4Schema = z.object({
  numberOfBuildings: z.coerce.number().int().min(1, "At least 1 building"),
  numberOfUnits: z.coerce.number().int().min(1, "At least 1 unit"),
  monthlyVolume: z.coerce.number().min(0).optional(),
  averageTransaction: z.coerce.number().min(0).optional(),
});

export const boardingSaveSchema = z.object({
  step: z.number().int().min(1).max(5),
  data: z.record(z.unknown()),
});

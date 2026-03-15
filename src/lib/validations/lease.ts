import { z } from "zod";

export const createLeaseSchema = z.object({
  tenantId: z.string().min(1, "Tenant is required"),
  unitId: z.string().min(1, "Unit is required"),
  propertyId: z.string().min(1, "Property is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  rentAmount: z.coerce.number().min(0, "Rent amount is required"),
  documentUrl: z.string().optional(),
  notes: z.string().optional(),
});

export const updateLeaseSchema = z.object({
  status: z.enum(["PENDING", "ACTIVE", "EXPIRED", "TERMINATED", "RENEWED"]).optional(),
  notes: z.string().optional(),
  documentUrl: z.string().optional(),
});

export const createAddendumSchema = z.object({
  type: z.enum(["RENEWAL", "TERMINATION", "AMENDMENT"]),
  newRentAmount: z.coerce.number().min(0).optional(),
  newEndDate: z.string().optional(),
  notes: z.string().optional(),
  documentUrl: z.string().optional(),
});

export type CreateLeaseInput = z.infer<typeof createLeaseSchema>;
export type UpdateLeaseInput = z.infer<typeof updateLeaseSchema>;
export type CreateAddendumInput = z.infer<typeof createAddendumSchema>;

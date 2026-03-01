import { z } from "zod";

export const chargeSchema = z.object({
  tenantId: z.string().min(1, "Tenant is required"),
  unitId: z.string().min(1, "Unit is required"),
  amount: z.coerce.number().min(0.01, "Amount must be at least $0.01"),
  type: z.enum(["RENT", "DEPOSIT", "FEE"]).default("RENT"),
  description: z.string().optional(),
});

export type ChargeInput = z.infer<typeof chargeSchema>;

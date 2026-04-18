import { z } from "zod";

export const chargeSchema = z.object({
  tenantId: z.string().min(1, "Tenant is required"),
  unitId: z.string().min(1, "Unit is required"),
  amount: z.coerce.number().min(0.01, "Amount must be at least $0.01"),
  type: z.enum(["RENT", "DEPOSIT", "FEE"]).default("RENT"),
  description: z.string().optional(),
  /**
   * Where the charge originated. Used for reporting (e.g. filter reports to
   * charges initiated by the PM via the virtual terminal vs tenant-portal
   * autopay). Optional for backward compatibility.
   */
  source: z
    .enum(["tenant-portal", "virtual-terminal", "autopay", "scheduled"])
    .optional(),
});

export type ChargeInput = z.infer<typeof chargeSchema>;

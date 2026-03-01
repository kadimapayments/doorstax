import { z } from "zod";

export const applicationSchema = z.object({
  unitId: z.string().min(1),
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().min(1, "Phone is required"),
  employment: z.string().min(1, "Employment status is required"),
  employer: z.string().optional(),
  income: z.coerce.number().min(0, "Income is required"),
  rentalHistory: z.string().optional(),
  references: z.array(z.object({
    name: z.string(),
    phone: z.string(),
    relationship: z.string(),
  })).optional(),
});

export type ApplicationInput = z.infer<typeof applicationSchema>;

import { z } from "zod";

export const expenseCategoryEnum = z.enum([
  "SERVICES",
  "UPGRADES",
  "TAXES",
  "MORTGAGE",
  "INSURANCE",
  "MAINTENANCE",
  "PAYROLL",
  "OTHER",
]);

export const createExpenseSchema = z.object({
  propertyId: z.string().min(1, "Property is required"),
  unitId: z.string().optional(),
  category: expenseCategoryEnum,
  amount: z.coerce.number().min(0.01, "Amount is required"),
  date: z.string().min(1, "Date is required"),
  description: z.string().min(1, "Description is required"),
  vendor: z.string().optional(),
  recurring: z.boolean().default(false),
  receiptUrl: z.string().optional(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

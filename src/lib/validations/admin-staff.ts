import { z } from "zod";

export const createAdminStaffSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
  adminRole: z.enum([
    "SUPER_ADMIN",
    "OPERATIONS_MANAGER",
    "FINANCE_MANAGER",
    "SUPPORT_AGENT",
    "VIEWER",
  ]),
  customPermissions: z.array(z.string()).default([]),
});

export const updateAdminStaffSchema = z.object({
  adminRole: z
    .enum([
      "SUPER_ADMIN",
      "OPERATIONS_MANAGER",
      "FINANCE_MANAGER",
      "SUPPORT_AGENT",
      "VIEWER",
    ])
    .optional(),
  customPermissions: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export type CreateAdminStaffInput = z.infer<typeof createAdminStaffSchema>;
export type UpdateAdminStaffInput = z.infer<typeof updateAdminStaffSchema>;

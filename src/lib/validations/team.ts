import { z } from "zod";

const TEAM_ROLES = [
  "MANAGER",
  "ACCOUNTING",
  "CARETAKER",
  "SERVICE_TECH",
  "LEASING_AGENT",
  "ASSISTANT_PM",
  "REGIONAL_MANAGER",
  "STAFF",
] as const;

export const inviteTeamMemberSchema = z.object({
  email: z.string().email("Valid email required"),
  name: z.string().optional(),
  role: z.enum(TEAM_ROLES),
  propertyIds: z.array(z.string()).default([]),
  notes: z.string().optional(),
  canViewFinancials: z.boolean().optional(),
  canManagePayments: z.boolean().optional(),
  canManageTenants: z.boolean().optional(),
  canManageUnits: z.boolean().optional(),
  canManageLeases: z.boolean().optional(),
  canManageMaintenance: z.boolean().optional(),
  canManageApplications: z.boolean().optional(),
  canViewReports: z.boolean().optional(),
  canManageSettings: z.boolean().optional(),
});

export const updateTeamMemberSchema = z.object({
  role: z.enum(TEAM_ROLES).optional(),
  name: z.string().optional(),
  propertyIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().optional(),
  canViewFinancials: z.boolean().optional(),
  canManagePayments: z.boolean().optional(),
  canManageTenants: z.boolean().optional(),
  canManageUnits: z.boolean().optional(),
  canManageLeases: z.boolean().optional(),
  canManageMaintenance: z.boolean().optional(),
  canManageApplications: z.boolean().optional(),
  canViewReports: z.boolean().optional(),
  canManageSettings: z.boolean().optional(),
});

export type InviteTeamMemberInput = z.infer<typeof inviteTeamMemberSchema>;
export type UpdateTeamMemberInput = z.infer<typeof updateTeamMemberSchema>;

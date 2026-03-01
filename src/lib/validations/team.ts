import { z } from "zod";

export const inviteTeamMemberSchema = z.object({
  email: z.string().email("Valid email required"),
  role: z.enum(["MANAGER", "ACCOUNTING", "CARETAKER", "SERVICE_TECH"]),
  propertyIds: z.array(z.string()).default([]),
});

export const updateTeamMemberSchema = z.object({
  role: z.enum(["MANAGER", "ACCOUNTING", "CARETAKER", "SERVICE_TECH"]).optional(),
  propertyIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export type InviteTeamMemberInput = z.infer<typeof inviteTeamMemberSchema>;
export type UpdateTeamMemberInput = z.infer<typeof updateTeamMemberSchema>;

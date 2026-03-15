import { z } from "zod";

export const createMessageSchema = z.object({
  type: z.enum(["DIRECT", "ANNOUNCEMENT"]).default("DIRECT"),
  recipientId: z.string().optional(), // For DIRECT messages — userId
  propertyId: z.string().optional(),  // For ANNOUNCEMENT — scope to property, or omit for all
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Message body is required"),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  threadId: z.string().optional(),    // For replies
  imageUrl: z.string().url().optional(),
});

export const acknowledgeMessageSchema = z.object({
  action: z.enum(["read", "acknowledge"]),
});

export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type AcknowledgeMessageInput = z.infer<typeof acknowledgeMessageSchema>;

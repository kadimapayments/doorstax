import { z } from "zod";

export const templateFieldSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "email", "phone", "number", "date", "select", "textarea"]),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
});

export const createTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  description: z.string().optional(),
  fields: z.array(templateFieldSchema).min(1, "At least one field is required"),
  isDefault: z.boolean().default(false),
});

export type TemplateField = z.infer<typeof templateFieldSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

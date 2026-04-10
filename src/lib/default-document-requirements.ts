import { db } from "@/lib/db";

export const DEFAULT_DOCUMENT_REQUIREMENTS = [
  {
    label: "Government-Issued Photo ID",
    description: "Driver license, passport, or state ID \u2014 front and back",
    required: true,
    acceptedTypes: ["image/jpeg", "image/png", "application/pdf"],
    maxFileSizeMb: 10,
    sortOrder: 1,
  },
  {
    label: "Proof of Income",
    description:
      "Recent pay stubs (last 2 months), employment letter, or tax return",
    required: true,
    acceptedTypes: ["image/jpeg", "image/png", "application/pdf"],
    maxFileSizeMb: 10,
    sortOrder: 2,
  },
  {
    label: "Bank Statements",
    description: "Last 2 months showing sufficient funds",
    required: false,
    acceptedTypes: ["image/jpeg", "image/png", "application/pdf"],
    maxFileSizeMb: 10,
    sortOrder: 3,
  },
  {
    label: "Rental History / Landlord Reference",
    description:
      "Letter from current/previous landlord or prior lease agreement",
    required: false,
    acceptedTypes: ["image/jpeg", "image/png", "application/pdf"],
    maxFileSizeMb: 10,
    sortOrder: 4,
  },
  {
    label: "Proof of Renters Insurance",
    description: "Insurance policy declaration page (if required)",
    required: false,
    acceptedTypes: ["image/jpeg", "image/png", "application/pdf"],
    maxFileSizeMb: 10,
    sortOrder: 5,
  },
];

/** Seed default document requirements for a template (idempotent) */
export async function seedDefaultDocumentRequirements(templateId: string) {
  const count = await db.applicationDocumentRequirement.count({
    where: { templateId },
  });
  if (count > 0) return;

  await db.applicationDocumentRequirement.createMany({
    data: DEFAULT_DOCUMENT_REQUIREMENTS.map((r) => ({
      ...r,
      templateId,
    })),
  });
}

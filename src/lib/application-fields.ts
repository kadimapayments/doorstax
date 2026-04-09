import { db } from "@/lib/db";

export const DEFAULT_APPLICATION_FIELDS = [
  // Personal
  { label: "Full Legal Name", type: "TEXT", required: true, section: "PERSONAL", sortOrder: 1 },
  { label: "Date of Birth", type: "DATE", required: true, section: "PERSONAL", sortOrder: 2 },
  { label: "Social Security Number", type: "TEXT", required: false, section: "PERSONAL", sortOrder: 3, helpText: "Required for credit/background check" },
  { label: "Phone Number", type: "PHONE", required: true, section: "PERSONAL", sortOrder: 4 },
  { label: "Email Address", type: "EMAIL", required: true, section: "PERSONAL", sortOrder: 5 },
  { label: "Government-Issued ID Number", type: "TEXT", required: false, section: "PERSONAL", sortOrder: 6 },
  // Employment
  { label: "Current Employer", type: "TEXT", required: true, section: "EMPLOYMENT", sortOrder: 10 },
  { label: "Job Title", type: "TEXT", required: false, section: "EMPLOYMENT", sortOrder: 11 },
  { label: "Monthly Gross Income", type: "NUMBER", required: true, section: "EMPLOYMENT", sortOrder: 12 },
  { label: "Length of Employment", type: "TEXT", required: false, section: "EMPLOYMENT", sortOrder: 13, placeholder: "e.g. 2 years" },
  { label: "Employer Phone", type: "PHONE", required: false, section: "EMPLOYMENT", sortOrder: 14 },
  // Rental History
  { label: "Current Address", type: "TEXTAREA", required: true, section: "RENTAL_HISTORY", sortOrder: 20 },
  { label: "Current Landlord Name", type: "TEXT", required: false, section: "RENTAL_HISTORY", sortOrder: 21 },
  { label: "Current Landlord Phone", type: "PHONE", required: false, section: "RENTAL_HISTORY", sortOrder: 22 },
  { label: "Monthly Rent at Current Address", type: "NUMBER", required: false, section: "RENTAL_HISTORY", sortOrder: 23 },
  { label: "Reason for Moving", type: "TEXTAREA", required: true, section: "RENTAL_HISTORY", sortOrder: 24 },
  { label: "Have you ever been evicted?", type: "SELECT", required: true, section: "RENTAL_HISTORY", sortOrder: 25, options: ["No", "Yes"] },
  // References
  { label: "Emergency Contact Name", type: "TEXT", required: true, section: "REFERENCES", sortOrder: 30 },
  { label: "Emergency Contact Phone", type: "PHONE", required: true, section: "REFERENCES", sortOrder: 31 },
  { label: "Emergency Contact Relationship", type: "TEXT", required: false, section: "REFERENCES", sortOrder: 32 },
  // Custom
  { label: "Do you have pets?", type: "SELECT", required: true, section: "CUSTOM", sortOrder: 40, options: ["No", "Yes \u2014 Dog", "Yes \u2014 Cat", "Yes \u2014 Other"] },
  { label: "Number of occupants (including yourself)", type: "NUMBER", required: true, section: "CUSTOM", sortOrder: 41 },
  { label: "Do you smoke?", type: "SELECT", required: true, section: "CUSTOM", sortOrder: 42, options: ["No", "Yes"] },
  { label: "Desired Move-in Date", type: "DATE", required: true, section: "CUSTOM", sortOrder: 43 },
  { label: "Have you ever filed for bankruptcy?", type: "SELECT", required: false, section: "CUSTOM", sortOrder: 44, options: ["No", "Yes"] },
  { label: "Vehicle Make/Model/Year (if applicable)", type: "TEXT", required: false, section: "CUSTOM", sortOrder: 45 },
  { label: "Additional Comments", type: "TEXTAREA", required: false, section: "CUSTOM", sortOrder: 99 },
];

/**
 * Ensure a PM has application fields. If none exist, seed the defaults.
 * Returns all fields for the PM, ordered by section + sortOrder.
 */
export async function ensureApplicationFields(pmId: string) {
  const count = await db.applicationField.count({ where: { pmId } });

  if (count === 0) {
    await db.applicationField.createMany({
      data: DEFAULT_APPLICATION_FIELDS.map((f) => ({
        pmId,
        label: f.label,
        type: f.type,
        required: f.required,
        section: f.section,
        sortOrder: f.sortOrder,
        options: (f as { options?: string[] }).options || [],
        placeholder: (f as { placeholder?: string }).placeholder || null,
        helpText: (f as { helpText?: string }).helpText || null,
      })),
    });
  }

  return db.applicationField.findMany({
    where: { pmId },
    orderBy: [{ section: "asc" }, { sortOrder: "asc" }],
  });
}

export const SECTION_LABELS: Record<string, string> = {
  PERSONAL: "Personal Information",
  EMPLOYMENT: "Employment",
  RENTAL_HISTORY: "Rental History",
  REFERENCES: "References",
  CUSTOM: "Additional Questions",
};

export const FIELD_TYPES = [
  "TEXT",
  "TEXTAREA",
  "SELECT",
  "CHECKBOX",
  "NUMBER",
  "DATE",
  "EMAIL",
  "PHONE",
] as const;

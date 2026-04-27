import { db } from "@/lib/db";

export const DEFAULT_ACCOUNTS = [
  // Assets (Normal balance: DEBIT)
  { code: "1000", name: "Operating Bank Account", type: "ASSET", subType: "BANK", normalBalance: "DEBIT", isSystem: true },
  { code: "1010", name: "Trust Bank Account", type: "ASSET", subType: "TRUST_BANK", normalBalance: "DEBIT", isSystem: true },
  { code: "1100", name: "Accounts Receivable \u2014 Tenants", type: "ASSET", subType: "ACCOUNTS_RECEIVABLE", normalBalance: "DEBIT", isSystem: true },
  { code: "1110", name: "Accounts Receivable \u2014 Owners", type: "ASSET", subType: "ACCOUNTS_RECEIVABLE", normalBalance: "DEBIT", isSystem: true },
  { code: "1200", name: "Security Deposit Escrow", type: "ASSET", subType: "ESCROW", normalBalance: "DEBIT", isSystem: true },
  { code: "1300", name: "Undeposited Funds", type: "ASSET", subType: "OTHER_CURRENT_ASSET", normalBalance: "DEBIT", isSystem: true },
  { code: "1400", name: "Prepaid Expenses", type: "ASSET", subType: "PREPAID", normalBalance: "DEBIT", isSystem: true },

  // Liabilities (Normal balance: CREDIT)
  { code: "2000", name: "Accounts Payable", type: "LIABILITY", subType: "ACCOUNTS_PAYABLE", normalBalance: "CREDIT", isSystem: true },
  { code: "2100", name: "Security Deposits Held", type: "LIABILITY", subType: "TRUST_LIABILITY", normalBalance: "CREDIT", isSystem: true },
  { code: "2200", name: "Owner Funds Payable", type: "LIABILITY", subType: "OWNER_PAYABLE", normalBalance: "CREDIT", isSystem: true },
  { code: "2300", name: "Tenant Prepaid Rent", type: "LIABILITY", subType: "DEFERRED_REVENUE", normalBalance: "CREDIT", isSystem: true },
  { code: "2400", name: "Accrued Expenses", type: "LIABILITY", subType: "ACCRUED", normalBalance: "CREDIT", isSystem: true },

  // Equity (Normal balance: CREDIT)
  { code: "3000", name: "Owner Equity", type: "EQUITY", subType: "EQUITY", normalBalance: "CREDIT", isSystem: true },
  { code: "3100", name: "Retained Earnings", type: "EQUITY", subType: "RETAINED_EARNINGS", normalBalance: "CREDIT", isSystem: true },

  // Revenue (Normal balance: CREDIT)
  { code: "4000", name: "Rent Revenue", type: "REVENUE", subType: "RENT_REVENUE", normalBalance: "CREDIT", isSystem: true },
  { code: "4100", name: "Late Fee Income", type: "REVENUE", subType: "FEE_INCOME", normalBalance: "CREDIT", isSystem: true },
  { code: "4200", name: "Application Fee Income", type: "REVENUE", subType: "FEE_INCOME", normalBalance: "CREDIT", isSystem: true },
  { code: "4300", name: "Management Fee Income", type: "REVENUE", subType: "MANAGEMENT_FEE", normalBalance: "CREDIT", isSystem: true },
  { code: "4400", name: "Processing Fee Income", type: "REVENUE", subType: "PROCESSING_FEE", normalBalance: "CREDIT", isSystem: true },
  { code: "4500", name: "Pet Fee Income", type: "REVENUE", subType: "FEE_INCOME", normalBalance: "CREDIT", isSystem: true },
  { code: "4600", name: "Parking Income", type: "REVENUE", subType: "OTHER_INCOME", normalBalance: "CREDIT", isSystem: true },
  { code: "4700", name: "Laundry Income", type: "REVENUE", subType: "OTHER_INCOME", normalBalance: "CREDIT", isSystem: true },
  { code: "4900", name: "Other Income", type: "REVENUE", subType: "OTHER_INCOME", normalBalance: "CREDIT", isSystem: true },

  // Expenses (Normal balance: DEBIT)
  { code: "5000", name: "Repairs & Maintenance", type: "EXPENSE", subType: "MAINTENANCE", normalBalance: "DEBIT", isSystem: true },
  { code: "5050", name: "Capital Improvements", type: "EXPENSE", subType: "MAINTENANCE", normalBalance: "DEBIT", isSystem: true },
  { code: "5100", name: "Utilities", type: "EXPENSE", subType: "UTILITIES", normalBalance: "DEBIT", isSystem: true },
  { code: "5200", name: "Insurance", type: "EXPENSE", subType: "INSURANCE", normalBalance: "DEBIT", isSystem: true },
  { code: "5250", name: "Mortgage Interest", type: "EXPENSE", subType: "MORTGAGE", normalBalance: "DEBIT", isSystem: true },
  { code: "5300", name: "Property Taxes", type: "EXPENSE", subType: "TAXES", normalBalance: "DEBIT", isSystem: true },
  { code: "5400", name: "Landscaping", type: "EXPENSE", subType: "MAINTENANCE", normalBalance: "DEBIT", isSystem: true },
  { code: "5500", name: "Cleaning", type: "EXPENSE", subType: "MAINTENANCE", normalBalance: "DEBIT", isSystem: true },
  { code: "5600", name: "Legal & Professional", type: "EXPENSE", subType: "PROFESSIONAL", normalBalance: "DEBIT", isSystem: true },
  { code: "5700", name: "Advertising & Marketing", type: "EXPENSE", subType: "MARKETING", normalBalance: "DEBIT", isSystem: true },
  { code: "5800", name: "Office & Administrative", type: "EXPENSE", subType: "ADMIN", normalBalance: "DEBIT", isSystem: true },
  { code: "5850", name: "Payroll & Benefits", type: "EXPENSE", subType: "PAYROLL", normalBalance: "DEBIT", isSystem: true },
  { code: "5900", name: "Payment Processing Fees", type: "EXPENSE", subType: "PROCESSING_EXPENSE", normalBalance: "DEBIT", isSystem: true },
  { code: "5950", name: "Bank Fees", type: "EXPENSE", subType: "BANK_FEES", normalBalance: "DEBIT", isSystem: true },
  { code: "5999", name: "Miscellaneous Expense", type: "EXPENSE", subType: "OTHER", normalBalance: "DEBIT", isSystem: true },
];

// ─── Expense category → account code mapping ───
// CRITICAL: every expense the PM logs must journal to the matching
// expense account, NOT default to 5000 Repairs & Maintenance. The
// previous default-fallback bug caused $65k in property taxes to land
// in the maintenance account.
//
// Mapping reflects the ExpenseCategory enum in prisma/schema.prisma.
// Keep them in sync — adding a new ExpenseCategory value without
// updating this mapping will silently fall through to OTHER (5999).
export type ExpenseCategoryValue =
  | "SERVICES"
  | "UPGRADES"
  | "TAXES"
  | "MORTGAGE"
  | "INSURANCE"
  | "MAINTENANCE"
  | "PAYROLL"
  | "PROCESSING_FEES"
  | "OTHER";

export function expenseCategoryToAccountCode(
  category: ExpenseCategoryValue | string | null | undefined
): string {
  switch (category) {
    case "TAXES":
      return "5300"; // Property Taxes
    case "INSURANCE":
      return "5200"; // Insurance
    case "MORTGAGE":
      return "5250"; // Mortgage Interest
    case "MAINTENANCE":
      return "5000"; // Repairs & Maintenance
    case "SERVICES":
      // Services (plumber, electrician, HVAC) most often == maintenance.
      // PMs sometimes use it for cleaning / landscaping vendors too;
      // we collapse to 5000 unless the chart-of-accounts grows a
      // dedicated 5xxx for vendor services.
      return "5000";
    case "UPGRADES":
      // Capital improvements get their own line so the P&L isn't
      // muddied with one-time renovation spend.
      return "5050";
    case "PAYROLL":
      return "5850"; // Payroll & Benefits
    case "PROCESSING_FEES":
      return "5900"; // Payment Processing Fees
    case "OTHER":
    default:
      return "5999"; // Miscellaneous Expense
  }
}

/**
 * Seed default chart of accounts for a PM (idempotent + additive).
 *
 * "Additive" means: if a PM already has SOME accounts but is missing
 * one of the system accounts (e.g. 5250 Mortgage Interest was added
 * to DEFAULT_ACCOUNTS later), seedDefaultAccounts fills the gap on
 * the next call. Without this, every existing PM in production would
 * be stuck on the original chart and new categories would silently
 * fall through to Misc.
 *
 * Safe to call repeatedly (createMany has skipDuplicates via unique
 * key (pmId, code)). Cheap when nothing's missing — single COUNT
 * query and an empty createMany.
 */
export async function seedDefaultAccounts(pmId: string) {
  const existing = await db.ledgerAccount.findMany({
    where: { pmId },
    select: { code: true },
  });
  const existingCodes = new Set(existing.map((a) => a.code));
  const missing = DEFAULT_ACCOUNTS.filter((a) => !existingCodes.has(a.code));
  if (missing.length === 0) return;

  await db.ledgerAccount.createMany({
    data: missing.map((a) => ({ ...a, pmId })),
    skipDuplicates: true,
  });
}

export const ACCOUNT_TYPE_ORDER = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];

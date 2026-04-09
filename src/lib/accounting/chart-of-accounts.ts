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
  { code: "5100", name: "Utilities", type: "EXPENSE", subType: "UTILITIES", normalBalance: "DEBIT", isSystem: true },
  { code: "5200", name: "Insurance", type: "EXPENSE", subType: "INSURANCE", normalBalance: "DEBIT", isSystem: true },
  { code: "5300", name: "Property Taxes", type: "EXPENSE", subType: "TAXES", normalBalance: "DEBIT", isSystem: true },
  { code: "5400", name: "Landscaping", type: "EXPENSE", subType: "MAINTENANCE", normalBalance: "DEBIT", isSystem: true },
  { code: "5500", name: "Cleaning", type: "EXPENSE", subType: "MAINTENANCE", normalBalance: "DEBIT", isSystem: true },
  { code: "5600", name: "Legal & Professional", type: "EXPENSE", subType: "PROFESSIONAL", normalBalance: "DEBIT", isSystem: true },
  { code: "5700", name: "Advertising & Marketing", type: "EXPENSE", subType: "MARKETING", normalBalance: "DEBIT", isSystem: true },
  { code: "5800", name: "Office & Administrative", type: "EXPENSE", subType: "ADMIN", normalBalance: "DEBIT", isSystem: true },
  { code: "5900", name: "Payment Processing Fees", type: "EXPENSE", subType: "PROCESSING_EXPENSE", normalBalance: "DEBIT", isSystem: true },
  { code: "5950", name: "Bank Fees", type: "EXPENSE", subType: "BANK_FEES", normalBalance: "DEBIT", isSystem: true },
  { code: "5999", name: "Miscellaneous Expense", type: "EXPENSE", subType: "OTHER", normalBalance: "DEBIT", isSystem: true },
];

/** Seed default chart of accounts for a PM (idempotent) */
export async function seedDefaultAccounts(pmId: string) {
  const existing = await db.ledgerAccount.count({ where: { pmId } });
  if (existing > 0) return;

  await db.ledgerAccount.createMany({
    data: DEFAULT_ACCOUNTS.map((a) => ({ ...a, pmId })),
  });
}

export const ACCOUNT_TYPE_ORDER = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];

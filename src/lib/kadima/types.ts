// ─── Kadima Gateway API Types ───────────────────────────

// Common
/** @deprecated Kadima returns raw objects, not wrapped in { success, data }.
 *  Use KadimaGatewayResponse (from gateway.ts) for card transactions.
 *  This type is retained for backward-compat in ach.ts and recurring.ts. */
export interface KadimaResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface KadimaPagination {
  page?: number;
  perPage?: number;
}

export interface KadimaListResponse<T> {
  success: boolean;
  data: T[];
  meta?: {
    total: number;
    page: number;
    perPage: number;
    lastPage: number;
  };
}

// ─── ACH Types ──────────────────────────────────────────

export interface AchTransaction {
  id: string;
  amount: number;
  status: string;
  type: string;
  customerId?: string;
  accountId?: string;
  firstName?: string;
  lastName?: string;
  routingNumber?: string;
  accountNumber?: string; // masked
  accountType?: string;
  secCode?: string;
  memo?: string;
  createdAt?: string;
  updatedAt?: string;
  effectiveDate?: string;
  returnCode?: string;
  returnReason?: string;
  traceNumber?: string;
  batchNumber?: string;
}

export interface CreateAchPayload {
  amount: number;
  firstName: string;
  lastName: string;
  routingNumber: string;
  accountNumber: string;
  accountType: "checking" | "savings";
  secCode?: "WEB" | "PPD" | "CCD" | "TEL";
  memo?: string;
  customerId?: string;
  accountId?: string;
}

export interface AchListParams extends KadimaPagination {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ─── Payment Gateway (Card) Types ───────────────────────

export type TransactionType = "sale" | "auth" | "capture" | "refund" | "void" | "credit";

export interface CardTransaction {
  id: string;
  amount: number;
  type: TransactionType;
  status: string;
  cardType?: string;
  lastFour?: string;
  authCode?: string;
  avsResponse?: string;
  cvvResponse?: string;
  customerId?: string;
  createdAt?: string;
  updatedAt?: string;
  referenceNumber?: string;
  responseCode?: string;
  responseText?: string;
  billingAddress?: {
    address1?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  processorResponse?: string;
  cardholderName?: string;
  entryMode?: string;
}

export interface CreateSalePayload {
  amount: number;
  cardNumber?: string;
  expirationDate?: string; // MMYY
  cvv?: string;
  firstName?: string;
  lastName?: string;
  // Tokenized
  customerId?: string;
  cardId?: string;
  // Billing
  address1?: string;
  city?: string;
  state?: string;
  zip?: string;
  // Options
  saveCard?: "required" | "optional" | "no";
  terminalId?: string;
}

export interface CreateAuthPayload extends CreateSalePayload {}

export interface CapturePayload {
  transactionId: string;
  amount?: number;
}

export interface RefundPayload {
  transactionId: string;
  amount?: number;
}

// ─── Customer Vault Types ───────────────────────────────
// Matches Kadima Dashboard API: https://developers.kadimadashboard.com

export interface Customer {
  id: number | string;
  dba?: { id: number | string };
  firstName: string;
  lastName: string;
  company?: string;
  email: string;
  phone?: string;
  identificator?: string;
  description?: string;
  website?: string;
  altPhone?: string;
  archived?: boolean;
  cards?: CustomerCard[];
  accounts?: CustomerAccount[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCustomerPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;          // E.164 format e.g. +18187740010
  identificator?: string;  // Required — links to our tenant ID
  company?: string;
  description?: string;
}

export interface UpdateCustomerPayload extends Partial<CreateCustomerPayload> {}

export interface CustomerCard {
  id: number | string;
  billing?: { id: number | string };
  number?: string;          // masked e.g. 411111******1111
  bin?: { brand?: string; type?: string; category?: string; issuer?: string };
  token?: string;
  exp?: string;             // mm/yy
  holderName?: string;
  status?: string;
  note?: string;
  cardType?: string;        // legacy alias
  lastFour?: string;        // derived from number
  expirationDate?: string;  // legacy alias
  isDefault?: boolean;
}

/**
 * Payload for POST /customer-vault/:customerId/card
 *
 * Per Kadima API docs, this endpoint requires:
 *   - billing.id (Integer, Required) — ID of a billing info record
 *   - terminal.id (Integer) — terminal to validate the card on
 *   - number (String, Required) — full card number OR token
 *   - cvv (String, Required)
 *   - exp (String, Required) — mm/yy
 *   - holderName (String)
 *
 * When using a hosted-fields token, pass it as `token` and omit
 * number/cvv (the token already encapsulates those).
 */
export interface AddCardPayload {
  billing?: { id: number | string };
  terminal?: { id: number | string };
  number?: string;
  cvv?: string;
  exp?: string;            // mm/yy
  holderName?: string;
  token?: string;          // hosted-fields card token (alternative to number/cvv)
}

// ─── Customer Vault — Billing Information ───────────────
// POST /customer-vault/:customerId/billing-information

export interface BillingInfo {
  id: number | string;
  firstName: string;
  lastName: string;
  address: string;
  state?: string;
  country: string;
  city: string;
  zip: string;
  phone?: string;
  email?: string;
  archived?: boolean;
}

export interface CreateBillingInfoPayload {
  firstName: string;
  lastName: string;
  address: string;
  state?: string;
  country: string;       // ISO country code e.g. "US"
  city: string;
  zip: string;
  phone?: string;
  email?: string;
}

export interface CustomerAccount {
  id: string;
  routingNumber?: string;
  accountNumber?: string; // masked
  accountType?: string;
  isDefault?: boolean;
}

export interface AddAccountPayload {
  routingNumber: string;
  accountNumber: string;
  accountType: "checking" | "savings";
  accountHolderName?: string;
}

// ─── Recurring Payment Types ────────────────────────────

export interface RecurringPayment {
  id: string;
  customerId: string;
  amount: number;
  status: string;
  frequency?: number;
  period?: "day" | "week" | "month" | "year";
  startDate?: string;
  endDate?: string;
  nextChargeDate?: string;
  paymentMethod?: string;
  cardId?: string;
  accountId?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Payload for POST /customer-vault/:customerId/recurring-payment
 *
 * Per Kadima API docs, required fields:
 *   name: String (required) — e.g. "Monthly subscription"
 *   amount: Decimal (required)
 *   execute: { frequency: Integer, period: String } (required)
 *   terminal: { id: Integer } (required)
 *   customer: { card: { id: Integer } } or { account: { id: Integer } }
 *   valid: { from: String, to: String } (optional)
 *   description: String (optional)
 */
export interface CreateRecurringPayload {
  /** Required — name/label for the recurring payment */
  name: string;
  amount: number;
  execute: {
    frequency: number;
    period: "day" | "week" | "month" | "year";
  };
  valid?: {
    from?: string;
    to?: string;
  };
  /** Nested terminal reference — required by Kadima */
  terminal: { id: number };
  /** Nested customer payment method reference */
  customer?: {
    card?: { id: number };
    account?: { id: number };
  };
  description?: string;
  /**
   * NACHA SEC code (camelCase here for TS convention; the wrapper
   * translates to the wire-level `SECCode`). Required by Kadima as of
   * 2026-05-05 for ACH-backed recurring schedules. Tenant autopay is
   * always "PPD". Card-only recurring schedules don't strictly need
   * this, but the wrapper sends it unconditionally — Kadima ignores
   * the extra field for card paths.
   */
  secCode?: "WEB" | "PPD" | "CCD" | "TEL";
}

export interface UpdateRecurringPayload {
  amount?: number;
  execute?: {
    frequency?: number;
    period?: "day" | "week" | "month" | "year";
  };
  valid?: {
    from?: string;
    to?: string;
  };
  /** Nested customer payment method reference — matches Kadima's expected structure */
  customer?: {
    card?: { id: number };
    account?: { id: number };
  };
}

// ─── Hosted Fields Types ────────────────────────────────

export interface HostedFieldsToken {
  access_token: string;
  issued_at?: number;
  expiration?: number;
  expires_at?: string;
}

export interface HostedFieldsTokenPayload {
  saveCard?: "required" | "optional" | "disabled";
  "3ds"?: boolean;
}

// ─── Reporting Types ────────────────────────────────────

export interface TransactionListParams extends KadimaPagination {
  status?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  amount?: number;
  amountFrom?: number;
  amountTo?: number;
}

export interface SettlementBatch {
  id: string;
  batchDate: string;
  totalAmount: number;
  transactionCount: number;
  status: string;
}

// ─── Webhook Types ──────────────────────────────────────

/**
 * Kadima webhook event structure.
 *
 * Per Kadima API docs, events are structured as:
 *   { id, module, action, date, data: { ... } }
 *
 * For card transaction events:
 *   module: "transaction", action: "create"
 *   data.transaction: { id, amount, status, statusReason, ... }
 *
 * For ACH events:
 *   module: "ach", action: "create" | "updateStatus"
 *   data: { id, amount, status, ... }  (flat ACH object)
 */
export interface WebhookEvent {
  /** Webhook event ID (NOT the transaction ID) */
  id: number | string;
  /** Module: "transaction" | "ach" | "customer-vault" etc. */
  module: string;
  /** Action: "create" | "updateStatus" | "createCustomer" etc. */
  action: string;
  /** Timestamp: "YYYY-MM-DD HH:MM:SS" */
  date: string;
  /** Event payload — structure depends on module */
  data: {
    /** For card transactions: data.merchant */
    merchant?: { mid?: number; name?: string; [key: string]: unknown };
    /** For card transactions: data.terminal */
    terminal?: { id?: number; [key: string]: unknown };
    /** For card transactions: data.transaction (nested) */
    transaction?: {
      id: number | string;
      amount?: number;
      type?: string;
      status?: string;
      statusReason?: string | null;
      [key: string]: unknown;
    };
    /** For ACH events: fields are flat in data */
    id?: number | string;
    amount?: number;
    status?: string;
    customerId?: number | string;
    accountNumber?: string;
    [key: string]: unknown;
  };
}

// ─── Kadima Gateway API Types ───────────────────────────

// Common
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

export interface CreateRecurringPayload {
  amount: number;
  execute: {
    frequency: number;
    period: "day" | "week" | "month" | "year";
  };
  valid?: {
    from?: string;
    to?: string;
  };
  cardId?: string;
  accountId?: string;
  memo?: string;
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
  cardId?: string;
  accountId?: string;
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

export interface WebhookEvent {
  event: string;
  data: {
    id: string;
    type?: string;
    status?: string;
    amount?: number;
    customerId?: string;
    [key: string]: unknown;
  };
  timestamp: string;
}

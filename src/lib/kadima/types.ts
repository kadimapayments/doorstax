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

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address1?: string;
  city?: string;
  state?: string;
  zip?: string;
  cards?: CustomerCard[];
  accounts?: CustomerAccount[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCustomerPayload {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address1?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export interface UpdateCustomerPayload extends Partial<CreateCustomerPayload> {}

export interface CustomerCard {
  id: string;
  cardType?: string;
  lastFour?: string;
  expirationDate?: string;
  isDefault?: boolean;
}

export interface AddCardPayload {
  cardNumber: string;
  expirationDate: string; // MMYY
  cvv?: string;
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

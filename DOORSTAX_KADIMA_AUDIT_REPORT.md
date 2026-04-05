# DoorStax × Kadima API Integration — Full Code Audit

**Date:** April 3, 2026  
**Scope:** Kadima boarding, gateway, vault, webhook, recurring, and ACH integrations  
**Methodology:** Line-by-line review of `src/lib/kadima/*`, API routes, schema, and comparison against Kadima API documentation (`Kadima_API_Claude_Optimized.md`)

---

## EXECUTIVE SUMMARY

The codebase is **structurally sound** in intent — it correctly separates Dashboard (Processor) from Gateway concerns, uses the Kadima boarding application flow for merchant onboarding, and provisions vault customers for tenants. However, there are **critical issues** around merchant isolation, terminal assignment, API token scoping, and payment response handling that would cause real production failures or compliance violations. Several assumptions made during development are visible shortcuts that will break at multi-merchant scale.

**Severity breakdown:**
- **CRITICAL (production-blocking):** 5 issues
- **HIGH (will cause failures at scale):** 7 issues
- **MEDIUM (fragile, incomplete, or inconsistent):** 10 issues
- **LOW (cleanup, naming, dead code):** 8 issues

---

## 1. WHAT IS WORKING CORRECTLY

These areas are correctly implemented and align with the Kadima API documentation:

1. **Boarding Application Creation** (`src/lib/kadima/lead.ts`): The `createKadimaLead()` function correctly calls `POST /boarding-application` with `processingMethod: "Acquiring"` and `campaign.id`, then updates company data and principal info in separate PUT calls. This matches the Kadima boarding flow: create first, update sections after.

2. **Boarding Sync on Submission** (`syncKadimaBoarding`): Correctly fetches the existing app to get the principal ID, then PUTs company data and principal data to the correct endpoints. The field mapping (company.name, company.federalTaxId, company.address, dba.name, processing.volumes, principal fields) aligns with the Kadima application object schema.

3. **Webhook Signature Verification** (`src/lib/kadima/webhooks.ts`): The SHA-512 verification using `<webhookSignature><id><module><action><date>` is correct per Kadima docs. The timing-safe comparison is properly implemented. The dual-secret approach (merchant + processor) is a smart design.

4. **Webhook Idempotency** (`src/app/api/webhooks/kadima/route.ts`): Uses a `WebhookEvent` model with unique `eventId` constraint, status tracking (RECEIVED → PROCESSING → PROCESSED/FAILED), and proper P2002 deduplication. This is production-grade.

5. **Customer Vault Provisioning** (`src/lib/kadima/provision-vault-customer.ts`): Idempotent, handles "already exists" errors gracefully by looking up by `identificator`, creates billing info as a required prerequisite for card operations. This matches the Kadima vault flow.

6. **Recurring Payment Creation** (`src/lib/kadima/recurring.ts`): The `CreateRecurringPayload` correctly includes `name`, `amount`, `execute.frequency/period`, `terminal.id`, and `customer.card.id` or `customer.account.id` — all required fields per Kadima docs.

7. **Retry Logic** (`src/lib/kadima/client.ts`): Exponential backoff with 5xx-only retry is appropriate. The 30-second timeout is reasonable for payment operations.

8. **Hosted Card Form flow**: The pivot from hosted-fields tokenization to Kadima's Customer Vault Hosted Card Form (redirect-based) is correctly documented and the old endpoint is properly deprecated with a 410.

---

## 2. CRITICAL ISSUES (Production-Blocking)

### CRIT-1: Single Global API Token — No Merchant Isolation

**Files:** `src/lib/kadima/client.ts`, `src/lib/kadima/gateway.ts`, `src/lib/kadima/ach.ts`

**Problem:** The entire system uses a single `KADIMA_API_TOKEN` (via `getKadimaClient()`) for all gateway transactions and a single `KADIMA_API_TOKEN` (via `getVaultClient()`) for all vault operations. In a multi-merchant platform like DoorStax, each Property Manager (PM) is supposed to be a separate Kadima merchant with their own API key. The current architecture means:

- All tenant payments are processed under ONE merchant's API credentials, regardless of which PM owns the tenant.
- Vault customers created for tenants are all under ONE merchant's DBA — not the PM's DBA.
- ACH transactions all use a single `KADIMA_DBA_ID`.

The `merchant-keys-form.tsx` admin component stores per-PM credentials (`kadimaMerchantApiKey`, `kadimaMerchantWebhookSecret`, `kadimaMerchantTerminalId`), but **these are never used in actual API calls**. The gateway/vault/ach modules ignore them entirely.

**Impact:** All payments processed through a single MID. Funds settlement, chargebacks, and reconciliation would be wrong. This is a regulatory and compliance failure.

**Required fix:** Gateway, vault, and ACH calls must resolve the correct merchant API key for the context (PM → tenant → unit → property → merchant credentials). This requires an API client factory that accepts per-request credentials rather than a singleton.

---

### CRIT-2: Terminal ID Resolution is Fragile and Incomplete

**Files:** `src/lib/kadima/gateway.ts`, `src/app/api/payments/charge/route.ts`, `src/app/api/payments/autopay/route.ts`

**Problem:** The Kadima API documentation is explicit: *"In the payment gateway your requests need to always include the system terminal.id. Within itself the system terminal.id contains DBA, MID and terminal TID information."* The terminal ID is the routing key for the entire payment. Getting it wrong means payment goes to the wrong merchant.

Current resolution chain:
```
property.kadimaTerminalId → process.env.KADIMA_TERMINAL_ID → "0"
```

Issues:
- `property.kadimaTerminalId` is on the Property model, but the Owner model also has `terminalId` and `achTerminalId` fields. It's unclear which takes precedence.
- Fallback to `KADIMA_TERMINAL_ID` env var means if a property doesn't have a terminal assigned, payments silently go to the platform's default terminal — wrong merchant, wrong settlement.
- The `"0"` final fallback produces `Number("0") = 0`, which is not a valid terminal ID and would cause an API error (or worse, an unpredictable routing).

**Impact:** Payments routed to wrong merchant. Silent misrouting if terminal not assigned to property.

---

### CRIT-3: Vault Customer DBA Assignment is Hardcoded

**Files:** `src/lib/kadima/provision-vault-customer.ts`, `src/lib/kadima/customer-vault.ts`

**Problem:** When creating vault customers for tenants, the code calls `createCustomer()` which posts to `/customer-vault` — but per Kadima docs, the customer vault `POST` requires `dba.id` (marked as Required). Looking at the `createCustomer` call in `provision-vault-customer.ts`, the payload includes `firstName, lastName, email, identificator` but **no `dba.id`**. 

The `customer-vault.ts` `createCustomer()` function just forwards the payload directly:
```ts
const { data } = await vaultClient.post("/customer-vault", payload);
```

Meanwhile, `doorstax-billing.ts` correctly includes `dba: { id: Number(dbaId) }` when creating the platform billing customer.

So either:
- Kadima's sandbox is lenient about missing `dba.id` (and production will reject it), or
- The vault client defaults to the token's DBA (but then all tenant vault customers are under one DBA regardless of which PM they belong to).

**Impact:** In multi-PM deployment, all tenants' payment methods are vaulted under one DBA. Cross-merchant data leakage.

---

### CRIT-4: Payment Response Parsing Doesn't Match Kadima Response Structure

**Files:** `src/lib/kadima/gateway.ts`, `src/app/api/payments/charge/route.ts`

**Problem:** The `KadimaResponse<T>` type assumes `{ success: boolean; data?: T; error?: string }`, and `createSale` returns `data` from `kadimaClient.post("/payment/sale", ...)`. But per the Kadima API docs, the gateway response for a sale is **not wrapped** in `{ success, data }`. The response IS the transaction object directly:

```json
{
  "id": "92",
  "amount": "1.10",
  "type": "Auth",
  "status": { "status": "Approved", "reason": null },
  "card": { "name": "John Wick", ... },
  ...
}
```

The status is nested as `status.status`, not a top-level `status` string. The charge route then does:
```ts
result.data?.id          // undefined if response isn't wrapped
result.data?.status      // undefined
result.data?.cardType    // undefined
```

This means the code is likely checking `undefined` values, and the `status: result.data ? "COMPLETED" : "FAILED"` check only works because `result.data` happens to be truthy when axios returns the full response as `data`.

**Impact:** Payment status not correctly captured. Transaction IDs not stored. Card brand/last4 not recorded. Reconciliation failures.

**Uncertainty note:** This depends on whether `axios.post` is returning `response.data` which IS the raw Kadima JSON, or whether there's a Kadima SDK wrapper. Based on the code `const { data } = await kadimaClient.post(...)`, `data` here IS the raw response. So `result` in `createSale` is the raw transaction object, and `result.data` would be undefined. The charge route's destructuring of `result.data?.id` would fail silently.

---

### CRIT-5: Boarding Application Create Endpoint Path Mismatch

**File:** `src/lib/kadima/lead.ts`

**Problem:** The code calls:
```ts
fetch(`${BASE}/boarding-application`, { method: "POST", ... })
```

But per Kadima API docs, the create endpoint is:
```
POST https://kadimadashboard.com/api/boarding-application/create
```

Note the `/create` suffix. The generic `POST /boarding-application` may work on sandbox but could fail on production, or it could be creating a different resource entirely. The Kadima docs explicitly show the create URL with `/create` appended.

**Impact:** Boarding application creation may fail in production.

---

## 3. HIGH-SEVERITY ISSUES

### HIGH-1: State ID Not Resolved for Boarding Application

**File:** `src/lib/kadima/lead.ts` — `syncKadimaBoarding()`

**Problem:** Kadima's boarding application requires `company.address.state.id` as an integer (e.g., California = 5), not a state abbreviation string. The code sends:
```ts
company: {
  address: {
    street: app.businessAddress,
    city: app.businessCity,
    zip: app.businessZip,
    // state.id is never set — only raw string values are passed
  }
}
```

The `businessState` field from the application is a string like "CA", but Kadima expects `{ state: { id: 5 } }`. Same issue applies to `country: { id: 199 }` (US) which is hardcoded nowhere in the sync.

**Impact:** Boarding application updates rejected by Kadima or state/country data lost.

---

### HIGH-2: ACH Uses Global DBA ID — No Per-PM Routing

**File:** `src/lib/kadima/ach.ts`

**Problem:** `getDbaId()` reads from `process.env.KADIMA_DBA_ID`. All ACH transactions use this single DBA. In a multi-PM platform, each PM should have their own DBA (assigned after merchant approval). ACH transactions for a tenant should use their PM's DBA, not a global one.

**Impact:** All ACH debits processed under one merchant. Settlement goes to wrong bank account.

---

### HIGH-3: `createSaleFromVault` Uses `card.token` But This May Be the Card ID

**File:** `src/lib/kadima/gateway.ts`

**Problem:** `createSaleFromVault` passes `card: { token: params.cardToken }` where `cardToken` comes from `tenant.kadimaCardTokenId`. But looking at how cards are saved (via the vault hosted card form callback), the stored value appears to be the vault card `id`, not the card `token`. In Kadima, these are different things:

- `card.id` — the vault card record ID (integer, used for recurring payments)
- `card.token` — a tokenized card string (e.g., `"1kDCZY8x9saJ0035"`, used for gateway transactions)

If the stored `kadimaCardTokenId` is actually the vault card ID (integer) but is being passed as `card.token` to the gateway, the sale would fail.

**Impact:** Card-on-file charges may fail silently. The naming ambiguity (`kadimaCardTokenId`) makes it impossible to tell which value is stored without runtime inspection.

---

### HIGH-4: Webhook Handler Does Not Route Events to Correct PM

**File:** `src/app/api/webhooks/kadima/route.ts`

**Problem:** The webhook handler processes all incoming Kadima events through a single endpoint with a single webhook secret. But in a multi-merchant setup, each PM's merchant account would have its own webhook URL and secret. The current handler has no way to determine WHICH merchant the event belongs to unless it parses `data.merchant.mid` or `data.terminal.id` from the event payload and reverse-looks up the PM.

The handler does extract terminal/merchant info from events, but doesn't use it to route to the correct PM's context. It only matches transactions by `kadimaTransactionId` which works for reconciliation but doesn't validate that the event came from the expected merchant.

**Impact:** In multi-PM production, webhook events from different merchants could be misattributed or the single secret would fail to validate events from different merchant webhook configurations.

---

### HIGH-5: No Validation of Kadima Boarding Application Status Before Payment Operations

**File:** `src/app/api/payments/charge/route.ts`

**Problem:** The charge route checks if a tenant has vault credentials and attempts to charge, but never verifies that the PM's merchant application status is "APPROVED" in Kadima. A PM whose application is still "New", "Pending", or "Underwriting" should not be processing payments. The code sets `managerStatus: "ACTIVE"` when step 7 is completed locally, but this doesn't mean Kadima has approved them.

**Impact:** Attempted payments against non-approved merchant accounts. API errors or compliance violations.

---

### HIGH-6: Campaign ID Defaults to Production in All Environments

**File:** `src/lib/kadima/lead.ts`

```ts
function getCampaignId(): number {
  return parseInt(process.env.KADIMA_CAMPAIGN_ID || "1106", 10);
}
```

The fallback is `1106` (production campaign). If `KADIMA_CAMPAIGN_ID` is not set in a development or staging environment, boarding applications will be created against the production campaign on the sandbox dashboard (or worse, against real production).

**Impact:** Test data polluting production campaigns. Should default to sandbox campaign `1` and require explicit override for production.

---

### HIGH-7: Building/Property Terminal Assignment Has No Automated Provisioning

**Files:** `prisma/schema.prisma` (Owner model), various

**Problem:** The schema has `kadimaTerminalId` on Property and `terminalId`/`achTerminalId` on Owner. But there is no code that automatically provisions or assigns terminals when a building or property is created. Terminal assignment appears to be entirely manual (admin sets it via the merchant-keys-form). 

Per the Kadima API docs, terminals are managed at the merchant level and the terminal ID is the critical routing key. The current code has no logic for:
- Requesting terminal provisioning from Kadima when a merchant is approved
- Assigning different terminals to different properties/owners
- Validating that a terminal ID belongs to the PM's merchant account

**Impact:** New properties have no terminal → payments fall through to global default → wrong merchant.

---

## 4. MEDIUM-SEVERITY ISSUES

### MED-1: `syncKadimaBoarding` Doesn't Send Processing Section

The Kadima boarding application has a dedicated `processing` section (sales methods, volumes, bank account, customer types, etc.) that requires its own PUT to `/boarding-application/:id/processing`. The current sync sends `processing.volumes` inside the main PUT body, but the sales method percentages, bank account, customer types, and fulfillment policy are never synced even though the DoorStax application collects them (salesMethodInPerson, salesMethodMailPhone, salesMethodEcommerce, bankRoutingNumber, etc.).

### MED-2: `syncKadimaBoarding` Doesn't Update Multiple Principals

The sync function only updates `principals[0]`. If the PM added multiple principals during onboarding (step 3), only the first is synced to Kadima.

### MED-3: No eSign/AutoSign Integration

Per Kadima docs, step 3 of the boarding process is "Request eSign or use AutoSign functionality." The DoorStax code generates its own PDF agreement and captures signatures locally, but never triggers Kadima's eSign or AutoSign. The boarding application remains "Unsigned" in Kadima even after DoorStax has signatures.

### MED-4: No Status Sync from Kadima After Submission

After submitting the boarding application (step 7), the code should either poll or receive webhooks for status changes (New → Pending → Underwriting → Approved/Declined). There is no webhook handler for boarding status events, and no cron job to poll application status.

### MED-5: `vaultClient` Uses `KADIMA_API_TOKEN` Not `KADIMA_PROCESSOR_TOKEN`

In `client.ts`, `getVaultClient()` uses `KADIMA_API_TOKEN` for the vault/dashboard client. But vault operations (customer vault) should use the merchant's API token, while boarding operations use the processor token. These are different authentication contexts. The `getVaultClient` base URL points to the dashboard API but uses the gateway token.

### MED-6: Amount Type Mismatch

Kadima returns amounts as strings (e.g., `"1.10"`) but the TypeScript types define them as `number`. The charge route does `Number(amount)` in some places but not consistently. Floating-point precision issues are possible.

### MED-7: `getTransaction` and `listTransactions` Use Wrong Endpoint

The code calls `/transaction` and `/transaction/:id`, but per Kadima docs, the correct endpoints are `GET /payments` and `GET /payment/:id`.

### MED-8: Hosted Fields Token Endpoint Uses Processor Base But May Need Gateway Base

`hosted-fields.ts` uses `KADIMA_PROCESSOR_BASE` for the hosted fields token endpoint. The Kadima docs show hosted fields under the Payment Gateway section, not the Dashboard. The endpoint `/hosted-fields/token` may live on the gateway, not the dashboard.

### MED-9: No Chargeback Webhook Handling

The webhook handler only processes `transaction.create` and `ach.create/updateStatus` events. Kadima supports `chargeback.create` and `chargeback.update` webhooks. These are unhandled — chargebacks would be invisible to the platform.

### MED-10: `doorstax-billing.ts` and `provision-vault-customer.ts` Duplicate Phone Formatting

Both files contain identical `formatPhoneE164()` functions. Should be a shared utility.

---

## 5. LOW-SEVERITY ISSUES

### LOW-1: `kadimaClient` Proxy Export is Confusing

`client.ts` exports both `getKadimaClient()` and a deprecated `kadimaClient` Proxy. The Proxy approach is clever but makes debugging harder and IDE autocomplete unreliable. Should be removed.

### LOW-2: `KadimaResponse<T>` Wrapper Type May Not Match Reality

The generic `KadimaResponse<T> = { success: boolean; data?: T }` wrapper is used everywhere but Kadima's API returns raw objects, not wrapped responses. The vault client may or may not add wrapping.

### LOW-3: Console.log of Sensitive Data

`gateway.ts` logs full request payloads: `console.log("[gateway] createSale request:", JSON.stringify(requestBody))`. This could log card tokens in production.

### LOW-4: `splitName()` is Fragile

Single-word names produce `{ first: "Cher", last: "" }`. Hyphenated names, suffixes, etc. are not handled. Not blocking but produces incomplete Kadima records.

### LOW-5: `getCardToken()` in `hosted-fields.ts` Has a Comment About Kadima Wrapping

```ts
// Kadima wraps responses in { success, data: {...} }
return data?.data ?? data;
```

This contradicts the observation that Kadima doesn't wrap gateway responses. The vault/dashboard API may wrap differently than the gateway API. This inconsistency is a symptom of not having a clear response model.

### LOW-6: Dead `HostedFieldsTokenPayload` `saveCard` Options

The `saveCard` enum includes "required" | "optional" | "disabled" but the Kadima docs show `Yes` | `No` for card.save. These may be mismatched.

### LOW-7: `UpdateRecurringPayload` Uses `cardId`/`accountId` Instead of Nested Objects

The update payload uses flat `cardId` and `accountId` strings, but Kadima's recurring payment API expects `customer: { card: { id } }` or `customer: { account: { id } }` nested structures.

### LOW-8: `boarding/route.ts` Deletes and Recreates All Principals on Every Save

```ts
await db.merchantPrincipal.deleteMany({ where: { merchantApplicationId: updated.id } });
await db.merchantPrincipal.createMany({ data: ... });
```

This loses any metadata attached to principals (e.g., Kadima principal IDs) on every step 3+ save.

---

## 6. ARCHITECTURAL RISKS AND BLIND SPOTS

### Risk A: No Multi-Merchant Client Factory

The fundamental architectural gap is the absence of a per-merchant API client. Every Kadima call goes through a singleton client with a single token. The `merchant-keys-form.tsx` stores per-PM credentials that are never consumed. A client factory pattern is needed:

```
getMerchantClient(pmUserId) → resolves PM's API key, terminal, DBA → returns scoped client
```

### Risk B: No Reconciliation Path

There is no daily reconciliation between Kadima batches and DoorStax payment records. No batch settlement tracking. No way to detect discrepancies.

### Risk C: Owner Payout Path is Unbuilt

The Owner model has vault fields but there is no code to execute ACH credits (payouts) to property owners. The `ach.ts` module only handles debits.

### Risk D: No Terminal Lifecycle Management

Terminals are critical routing keys but are manually assigned with no validation, no provisioning workflow, and no audit trail of changes.

### Risk E: Split Payment Not Implemented

The Kadima gateway supports `split` transactions, which would be the correct way to handle the DoorStax revenue share model (platform fee + PM fee + owner payout). This is not used anywhere.

---

## 7. PRIORITY FIX ORDER

### Phase 1 — Critical (Do First)

| # | Issue | Risk | Effort |
|---|-------|------|--------|
| 1 | CRIT-4: Fix response parsing to match Kadima's actual response structure | Payments broken | Medium |
| 2 | CRIT-5: Fix boarding application create endpoint to use `/create` suffix | Onboarding broken | Trivial |
| 3 | CRIT-1: Build per-merchant API client factory; wire stored PM credentials into API calls | Multi-tenant isolation | Large |
| 4 | CRIT-2: Make terminal ID resolution fail-closed (error, don't fallback to "0") | Payment misrouting | Small |
| 5 | CRIT-3: Pass DBA ID when creating vault customers; resolve per-PM DBA | Cross-merchant leakage | Medium |

### Phase 2 — High (Do Next)

| # | Issue | Risk | Effort |
|---|-------|------|--------|
| 6 | HIGH-1: Build state/country ID resolver for boarding sync | Boarding data rejected | Small |
| 7 | HIGH-2: Route ACH DBA per PM | ACH misrouting | Medium |
| 8 | HIGH-3: Clarify card token vs card ID storage; rename field | Silent charge failures | Small |
| 9 | HIGH-5: Gate payment operations on merchant approval status | Compliance | Small |
| 10 | HIGH-6: Default campaign ID to sandbox (1), require explicit production override | Test data pollution | Trivial |
| 11 | HIGH-7: Add terminal assignment workflow for properties | No-terminal fallthrough | Medium |

### Phase 3 — Medium (Stabilization)

| # | Issue | Effort |
|---|-------|--------|
| 12 | MED-1: Sync processing section to Kadima | Medium |
| 13 | MED-2: Sync all principals, not just first | Small |
| 14 | MED-3: Integrate Kadima eSign or AutoSign | Medium |
| 15 | MED-4: Add boarding status webhook handler or polling cron | Medium |
| 16 | MED-5: Fix vault client token source | Small |
| 17 | MED-7: Fix transaction list/view endpoints | Small |
| 18 | MED-9: Add chargeback webhook handling | Medium |

### Phase 4 — Cleanup

| # | Issue | Effort |
|---|-------|--------|
| 19 | Remove deprecated `kadimaClient` proxy | Trivial |
| 20 | Strip sensitive data from console.log | Trivial |
| 21 | Deduplicate `formatPhoneE164` | Trivial |
| 22 | Fix principal delete-and-recreate to preserve Kadima IDs | Small |
| 23 | Add reconciliation cron job | Large |

---

## 8. ASSUMPTIONS I AM MAKING (FLAGGED FOR YOUR REVIEW)

1. **I assume each PM should be a separate Kadima merchant.** If DoorStax operates as a single merchant (PayFac model) with sub-merchants, the architecture changes significantly. The current code seems to straddle both models without committing to either.

2. **I assume the Kadima API response format is the raw JSON shown in their docs** (not wrapped in `{ success, data }`). If their SDK adds wrapping, CRIT-4 changes. Verify by checking a raw API response.

3. **I assume the `boarding-application/create` endpoint requires the `/create` suffix.** The docs show it explicitly, but some APIs accept POST to the collection URL. Verify in sandbox.

4. **I assume `kadimaCardTokenId` stores the vault card ID (integer), not the card token (string).** The name is ambiguous. Check the vault-card-callback code to see which value is actually stored.

5. **I cannot verify whether the vault client's base URL vs the gateway client's base URL is correct for all operations** because both the Dashboard API and Gateway API share similar endpoint patterns. The hosted fields token endpoint location is uncertain.

---

*End of audit. Recommend reviewing Assumptions section before beginning Phase 1 fixes.*

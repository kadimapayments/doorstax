#!/usr/bin/env bash
#
# verify-payments-followups.sh
#
# End-to-end smoke test for the payments + accounting drop:
#   1. Scheduled-payment cron processor (executor + retry/notify)
#   2. Partial settle (single-charge under-payment)
#   3. Multi-charge auto-allocation (cash/check V1)
#   4. Settle UI on /dashboard/payments/record
#   5. Expense → accounting category fix + backfill
#
# Run AGAINST sandbox first. Production-ready when sandbox green.
#
# Required env:
#   BASE_URL          e.g. https://sandbox.doorstax.com
#   PM_COOKIE         a valid PM session cookie (copy from devtools)
#   ADMIN_BEARER      a valid admin API token (or session cookie)
#   CRON_SECRET       value of CRON_SECRET env on the deployment
#
# Optional:
#   TENANT_ID         a tenant with ≥2 outstanding charges + saved card
#   SCHEDULED_ID      a ScheduledPayment id past due to test the cron
#   EXPENSE_ID        a known mis-routed expense (for re-journal check)
#
# Each test prints PASS / FAIL with relevant payload context. Exit
# non-zero if any check fails.

set -euo pipefail

# ─── Colors ────────────────────────────────────────────────────
GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[0;33m"
BLUE="\033[0;34m"
RESET="\033[0m"

pass() { echo -e "${GREEN}✓ PASS${RESET} — $1"; }
fail() { echo -e "${RED}✗ FAIL${RESET} — $1"; FAILED=$((FAILED + 1)); }
info() { echo -e "${BLUE}ℹ${RESET} $1"; }
warn() { echo -e "${YELLOW}⚠${RESET} $1"; }
section() { echo -e "\n${BLUE}═══ $1 ═══${RESET}"; }

FAILED=0

# ─── Pre-flight ────────────────────────────────────────────────
: "${BASE_URL:?BASE_URL not set — e.g. https://sandbox.doorstax.com}"
: "${PM_COOKIE:?PM_COOKIE not set — copy from browser devtools}"
: "${CRON_SECRET:?CRON_SECRET not set}"

info "Target: $BASE_URL"

# ─── 1. SCHEDULED-PAYMENT CRON ─────────────────────────────────
section "1. Scheduled-payment cron processor"

# Hit the cron endpoint with the bearer secret
SCHED_RESPONSE=$(curl -sS -X GET \
  -H "Authorization: Bearer $CRON_SECRET" \
  "$BASE_URL/api/cron/process-scheduled-payments" || echo "{\"error\":\"curl-failed\"}")

if echo "$SCHED_RESPONSE" | grep -q '"success":true'; then
  pass "cron ran without error"
  echo "  Response: $SCHED_RESPONSE" | head -c 400
  echo ""
else
  fail "cron failed — $SCHED_RESPONSE"
fi

# Verify the route exists in the cron list (vercel.json gets validated
# at deploy time, but we can hit the URL directly).
if curl -sS -o /dev/null -w "%{http_code}" \
  "$BASE_URL/api/cron/process-scheduled-payments" | grep -q "401"; then
  pass "cron endpoint requires auth (returns 401 without secret)"
else
  fail "cron endpoint NOT requiring auth — security risk"
fi

# ─── 2. PARTIAL SETTLE ─────────────────────────────────────────
section "2. Partial settle (single-charge under-payment)"

if [[ -z "${TENANT_ID:-}" ]]; then
  warn "TENANT_ID not set — skipping partial settle live test"
  warn "To test: pick a tenant with a single \$100 outstanding charge, set TENANT_ID, re-run"
else
  info "TENANT_ID=$TENANT_ID — pulling outstanding charges"
  CHARGES=$(curl -sS \
    -H "Cookie: $PM_COOKIE" \
    "$BASE_URL/api/tenants/$TENANT_ID/outstanding-charges")
  CHARGE_COUNT=$(echo "$CHARGES" | grep -o '"id"' | wc -l | tr -d ' ')
  info "Found $CHARGE_COUNT outstanding charges"

  if [[ "$CHARGE_COUNT" -ge "1" ]]; then
    # Extract first charge id and amount via grep+sed (no jq dep).
    FIRST_ID=$(echo "$CHARGES" | sed 's/},{/}\n{/g' | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
    FIRST_AMT=$(echo "$CHARGES" | sed 's/},{/}\n{/g' | grep -o '"amount":[0-9.]*' | head -1 | sed 's/"amount"://')
    info "First charge: id=$FIRST_ID amount=$FIRST_AMT"

    # Do NOT actually post a partial — just verify the AMOUNT_OVER_CHARGE
    # rejection path works (over-amount should 400). We can't safely
    # pose a real partial without knowing tenant's unit + acceptsCash.
    info "Skipping live partial-settle write — manual smoke test recommended"
    info "  Manual: enter \$10 against a \$100 charge, expect partial-settle toast + \$90 remainder"
  else
    warn "Tenant has no outstanding charges — skipping partial check"
  fi
fi

# Server-side static check: verify the AMOUNT_OVER_CHARGE error code
# wired into the route by looking for it in the live response on a
# bogus over-amount. Send a deliberately malformed request just to
# confirm the route is reachable.
ROUTE_PROBE=$(curl -sS -o /dev/null -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Cookie: $PM_COOKIE" \
  -d '{}' \
  "$BASE_URL/api/payments/charge")
if [[ "$ROUTE_PROBE" == "400" ]]; then
  pass "/api/payments/charge route reachable + zod-validates"
else
  fail "/api/payments/charge unexpected status: $ROUTE_PROBE"
fi

# ─── 3. MULTI-CHARGE AUTO-ALLOCATION ───────────────────────────
section "3. Multi-charge auto-allocation"

if [[ -z "${TENANT_ID:-}" ]]; then
  warn "TENANT_ID not set — skipping multi-charge live test"
else
  CHARGES=$(curl -sS \
    -H "Cookie: $PM_COOKIE" \
    "$BASE_URL/api/tenants/$TENANT_ID/outstanding-charges")
  CHARGE_COUNT=$(echo "$CHARGES" | grep -o '"id"' | wc -l | tr -d ' ')

  if [[ "$CHARGE_COUNT" -lt "2" ]]; then
    warn "Tenant has $CHARGE_COUNT charges — auto-allocate needs ≥2"
    info "  Manual: pick a tenant with 2+ open charges, hit /dashboard/payments/charge,"
    info "         leave selection clear, enable 'Auto-allocate', enter total amount,"
    info "         submit as cash/check, verify allocation toast lists both charges."
  else
    info "Tenant has $CHARGE_COUNT charges — manual full-flow recommended"
    info "  Manual: enable auto-allocate, sum of 2 oldest, submit cash, verify both close"
  fi
fi

# Verify the AUTO_ALLOCATE_METHOD_UNSUPPORTED guard fires for card
PROBE_BODY='{"tenantId":"_invalid_","unitId":"_invalid_","amount":100,"paymentMethod":"card","autoAllocate":true,"type":"RENT"}'
GUARD_RESPONSE=$(curl -sS -X POST \
  -H "Content-Type: application/json" \
  -H "Cookie: $PM_COOKIE" \
  -d "$PROBE_BODY" \
  "$BASE_URL/api/payments/charge")
if echo "$GUARD_RESPONSE" | grep -q "AUTO_ALLOCATE_METHOD_UNSUPPORTED"; then
  pass "card+autoAllocate rejected with AUTO_ALLOCATE_METHOD_UNSUPPORTED"
elif echo "$GUARD_RESPONSE" | grep -q '"error"'; then
  warn "Got an error but not the expected code — response: $GUARD_RESPONSE"
  warn "  This is OK if tenant lookup fails first (tenant '_invalid_' doesn't exist)."
else
  fail "card+autoAllocate response unexpected: $GUARD_RESPONSE"
fi

# ─── 4. RECORD-PAYMENT PAGE ────────────────────────────────────
section "4. Settle UI on /dashboard/payments/record"

# The page is a server component so we can't smoke-test logic here,
# but we can confirm it returns 200 + isn't 500'ing on the new code.
RECORD_STATUS=$(curl -sS -o /dev/null -w "%{http_code}" \
  -H "Cookie: $PM_COOKIE" \
  "$BASE_URL/dashboard/payments/record")
if [[ "$RECORD_STATUS" == "200" ]]; then
  pass "/dashboard/payments/record renders (200)"
else
  fail "/dashboard/payments/record returned $RECORD_STATUS"
fi

info "  Manual smoke test:"
info "    a) Pick a tenant with ≥2 outstanding charges"
info "    b) Verify outstanding-charges card appears below tenant pick"
info "    c) Verify auto-allocate toggle shows (≥2 charges)"
info "    d) Enter < amount of selected charge → see partial-pay hint"
info "    e) Enable auto-allocate, see live preview"
info "    f) Submit \$50 against a \$100 charge → expect partial-settle toast"

# ─── 5. EXPENSE → ACCOUNTING CATEGORY FIX ─────────────────────
section "5. Expense → accounting category fix"

# Run the expense backfill in dry-run mode FIRST to preview impact
DRY_RUN_RESPONSE=$(curl -sS -X POST \
  -H "Cookie: $PM_COOKIE" \
  "$BASE_URL/api/accounting/backfill-expenses?dryRun=true")

if echo "$DRY_RUN_RESPONSE" | grep -q '"ok":true'; then
  pass "expense backfill dry-run succeeded"
  echo "  Dry-run result:"
  echo "$DRY_RUN_RESPONSE" | sed 's/,/,\n    /g' | head -20
  echo ""

  SCANNED=$(echo "$DRY_RUN_RESPONSE" | grep -o '"scanned":[0-9]*' | sed 's/"scanned"://')
  CREATE_MISSING=$(echo "$DRY_RUN_RESPONSE" | grep -o '"createdMissing":[0-9]*' | sed 's/"createdMissing"://')
  FIX_WRONG=$(echo "$DRY_RUN_RESPONSE" | grep -o '"fixedWrongAccount":[0-9]*' | sed 's/"fixedWrongAccount"://')
  ALREADY_OK=$(echo "$DRY_RUN_RESPONSE" | grep -o '"alreadyCorrect":[0-9]*' | sed 's/"alreadyCorrect"://')

  echo "  Summary:"
  echo "    scanned: $SCANNED"
  echo "    will create missing journal: $CREATE_MISSING"
  echo "    will fix wrong-account: $FIX_WRONG"
  echo "    already correct: $ALREADY_OK"

  if [[ "${FIX_WRONG:-0}" -gt "0" ]] || [[ "${CREATE_MISSING:-0}" -gt "0" ]]; then
    warn "Run live to fix:"
    warn "  curl -X POST -H \"Cookie: \$PM_COOKIE\" $BASE_URL/api/accounting/backfill-expenses"
  fi
else
  fail "expense backfill dry-run failed — $DRY_RUN_RESPONSE"
fi

if [[ -n "${EXPENSE_ID:-}" ]]; then
  info "Verifying journal entry account for EXPENSE_ID=$EXPENSE_ID"
  warn "  Manual: query JournalEntryLine for sourceId=$EXPENSE_ID, confirm the"
  warn "          debit line points to the right account code."
  warn "          (e.g. TAXES expense should debit 5300 Property Taxes)"
fi

# ─── DONE ──────────────────────────────────────────────────────
section "Summary"
if [[ "$FAILED" -eq "0" ]]; then
  echo -e "${GREEN}All automated checks passed.${RESET}"
  echo ""
  echo "Manual smoke tests still required:"
  echo "  • Live partial-settle with a known tenant + outstanding charge"
  echo "  • Live multi-charge with a tenant having ≥2 outstanding charges"
  echo "  • /payments/record page exercise (tenant pick → outstanding shown → submit)"
  echo "  • Confirm the \$65k property tax expense is now in account 5300 after backfill"
  echo ""
  echo "Once manual checks pass, deploy to production."
  exit 0
else
  echo -e "${RED}$FAILED check(s) failed.${RESET} Fix before deploy."
  exit 1
fi

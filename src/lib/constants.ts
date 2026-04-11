/** Number of days a PM has to complete their merchant application after first dashboard access. */
export const COMPLIANCE_WINDOW_DAYS = 14;

/** Number of units required to unlock the earnings/residuals page. */
export const EARNINGS_UNLOCK_UNITS = 100;

/* ── Session Security (Stripe-style) ─────────────────────────── */

/** Idle time before the session locks (20 minutes). */
export const SESSION_LOCK_MS = 20 * 60 * 1000;

/** Warning shown this many ms before session lock (2 minutes). */
export const SESSION_LOCK_WARNING_MS = 2 * 60 * 1000;

/** Idle time before hard logout (60 minutes). */
export const SESSION_HARD_LOGOUT_MS = 60 * 60 * 1000;

/** Maximum session lifetime — force re-auth even if active (8 hours). */
export const SESSION_MAX_LIFETIME_MS = 8 * 60 * 60 * 1000;

/** How often to check idle / session state (15 seconds). */
export const SESSION_CHECK_INTERVAL_MS = 15_000;

/** localStorage keys for cross-tab session sync. */
export const STORAGE_KEY_LAST_ACTIVITY = "doorstax-last-activity";
export const STORAGE_KEY_SESSION_LOCKED = "doorstax-session-locked";
export const STORAGE_KEY_SESSION_START = "doorstax-session-start";

/** Number of onboarding milestones for Guided Launch Mode. */
export const ONBOARDING_MILESTONES_TOTAL = 4;

/** Dashboard routes accessible during Guided Launch Mode (before full app unlock). */
export const ONBOARDING_ALLOWED_ROUTES = [
  "/dashboard",
  "/dashboard/properties",
  "/dashboard/tenants",
  "/dashboard/onboarding",
  "/dashboard/settings",
  "/dashboard/migrate",
] as const;

/** Number of days a PM has to complete their merchant application after first dashboard access. */
export const COMPLIANCE_WINDOW_DAYS = 7;

/** Number of units required to unlock the earnings/residuals page. */
export const EARNINGS_UNLOCK_UNITS = 100;

/** Inactivity timeout in milliseconds (10 minutes). */
export const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;

/** Warning shown this many ms before auto-logout (1 minute). */
export const INACTIVITY_WARNING_MS = 1 * 60 * 1000;

/** Number of onboarding milestones for Guided Launch Mode. */
export const ONBOARDING_MILESTONES_TOTAL = 4;

/** Dashboard routes accessible during Guided Launch Mode (before full app unlock). */
export const ONBOARDING_ALLOWED_ROUTES = [
  "/dashboard",
  "/dashboard/properties",
  "/dashboard/tenants",
  "/dashboard/onboarding",
  "/dashboard/settings",
] as const;

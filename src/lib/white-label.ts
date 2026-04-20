import { db } from "@/lib/db";

/**
 * Resolve a WhiteLabelPartner by custom domain hostname.
 * Returns the active partner record or null if no match.
 *
 * Called from the root layout on EVERY request, so a transient DB blip
 * here 500s the entire app. We defend with:
 *   - short retry loop (3 attempts × 400ms) — handles Neon cold-start
 *     wake-up latency without noticeable delay to the user
 *   - graceful null fallback — on permanent failure, render default
 *     DoorStax branding instead of crashing the layout
 *
 * Neon auto-suspends the prod endpoint after ~5 minutes of idle on the
 * default plan; the first request after suspension pays a 300–800ms
 * cold-start cost. Setting `connect_timeout=15` on the DATABASE_URL
 * makes Prisma wait for that wake-up; this retry loop covers the tail
 * case where the wake-up itself is slow or racy.
 */
export async function resolveWhiteLabelPartner(hostname: string) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.whiteLabelPartner.findFirst({
        where: {
          customDomain: hostname,
          isActive: true,
        },
      });
    } catch (err) {
      lastError = err;
      // Only retry on connection-class errors; bail immediately for
      // schema / query errors which won't get better with a retry.
      const code = (err as { code?: string; name?: string })?.name || "";
      const msg = (err as Error)?.message || "";
      const isConnError =
        /PrismaClientInitializationError|Can't reach database server|connect ECONNREFUSED|ETIMEDOUT/.test(
          `${code} ${msg}`
        );
      if (!isConnError || attempt === 2) break;
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  // Final fallback: default branding. Log so the failure is visible
  // in Vercel logs without taking the page down.
  console.error(
    "[white-label] resolve failed after retries, falling back to default branding:",
    lastError
  );
  return null;
}

/**
 * Returns the default DoorStax branding values.
 */
export function getDefaultBranding() {
  return {
    name: "DoorStax",
    logoUrl: null as string | null,
    faviconUrl: null as string | null,
    primaryColor: "#5B00FF",
    accentColor: "#BDA2FF",
    isWhiteLabel: false,
  };
}

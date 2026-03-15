import { db } from "@/lib/db";

/**
 * Resolve a WhiteLabelPartner by custom domain hostname.
 * Returns the active partner record or null if no match.
 */
export async function resolveWhiteLabelPartner(hostname: string) {
  const partner = await db.whiteLabelPartner.findFirst({
    where: {
      customDomain: hostname,
      isActive: true,
    },
  });

  return partner;
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

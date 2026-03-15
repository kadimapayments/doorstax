import { requireRole } from "@/lib/auth-utils";
import { cookies } from "next/headers";
import { ImpersonationBanner } from "@/components/layout/impersonation-banner";
import type { ImpersonationData } from "@/components/layout/impersonation-banner";

export default async function TenantOnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Must be a TENANT to access onboarding
  await requireRole("TENANT");

  // Read impersonation cookie so PM can exit if they land here
  const cookieStore = await cookies();
  const raw = cookieStore.get("impersonating")?.value;
  let impersonationData: ImpersonationData | null = null;
  if (raw) {
    try {
      impersonationData = JSON.parse(raw);
    } catch {
      // Invalid cookie
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <ImpersonationBanner data={impersonationData} />
      {children}
    </div>
  );
}

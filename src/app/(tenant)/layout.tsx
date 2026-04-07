import { TenantNav, navItems } from "@/components/layout/tenant-nav";
import { SidebarLayout } from "@/components/layout/sidebar-layout";
import { TopBar } from "@/components/layout/top-bar";
import { ImpersonationBanner } from "@/components/layout/impersonation-banner";
import type { ImpersonationData } from "@/components/layout/impersonation-banner";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SessionSecurityProvider } from "@/components/providers/session-security-provider";
import { requireRole } from "@/lib/auth-utils";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export default async function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("TENANT");

  // Read impersonation cookie server-side (httpOnly) — must happen BEFORE onboarding gate
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

  // Gate: redirect to onboarding if not complete (skip when impersonating)
  if (!impersonationData) {
    const profile = await db.tenantProfile.findUnique({
      where: { userId: user.id },
      select: { onboardingComplete: true },
    });

    if (profile && !profile.onboardingComplete) {
      redirect("/tenant-onboarding");
    }
  }

  return (
    <SessionSecurityProvider>
      <div className="min-h-screen">
        <ImpersonationBanner data={impersonationData} />
        <SidebarLayout sidebar={<TenantNav />}>
          <TopBar mobileNav={<MobileNav items={navItems} logoHref="/tenant" />} />
          <main className="p-4 sm:p-6 animate-fade-in-up">{children}</main>
        </SidebarLayout>
      </div>
    </SessionSecurityProvider>
  );
}

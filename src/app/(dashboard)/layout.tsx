import { Sidebar } from "@/components/layout/sidebar";
import { SidebarLayout } from "@/components/layout/sidebar-layout";
import { TopBar } from "@/components/layout/top-bar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ImpersonationBanner } from "@/components/layout/impersonation-banner";
import type { ImpersonationData } from "@/components/layout/impersonation-banner";
import { requireRole } from "@/lib/auth-utils";
import { getTeamContext } from "@/lib/team-context";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { InactivityProvider } from "@/components/providers/inactivity-provider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("PM");
  const ctx = await getTeamContext(user.id);

  // Count units for monetize padlock
  const unitCount = await db.unit.count({
    where: { property: { landlordId: ctx.landlordId } },
  });

  // Read impersonation cookie server-side (httpOnly)
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
    <InactivityProvider>
      <div className="min-h-screen">
        <ImpersonationBanner data={impersonationData} />
        <SidebarLayout sidebar={<Sidebar permissions={ctx.permissions} unitCount={unitCount} />}>
          <TopBar
            teamRole={ctx.teamRole}
            mobileNav={<MobileNav permissions={ctx.permissions} unitCount={unitCount} logoHref="/dashboard" />}
          />
          <main className="p-6 animate-fade-in-up">{children}</main>
        </SidebarLayout>
      </div>
    </InactivityProvider>
  );
}

import { OwnerNav, navItems } from "@/components/layout/owner-nav";
import { SidebarLayout } from "@/components/layout/sidebar-layout";
import { TopBar } from "@/components/layout/top-bar";
import { ImpersonationBanner } from "@/components/layout/impersonation-banner";
import type { ImpersonationData } from "@/components/layout/impersonation-banner";
import { MobileNav } from "@/components/layout/mobile-nav";
import { requireRole } from "@/lib/auth-utils";
import { cookies } from "next/headers";

export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("OWNER");

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
    <div className="min-h-screen">
      <ImpersonationBanner data={impersonationData} />
      <SidebarLayout sidebar={<OwnerNav />}>
        <TopBar mobileNav={<MobileNav items={navItems} logoHref="/owner" />} />
        <main className="p-6 animate-fade-in-up">{children}</main>
      </SidebarLayout>
    </div>
  );
}

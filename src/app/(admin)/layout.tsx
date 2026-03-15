import { AdminNav } from "@/components/layout/admin-nav";
import { AdminMobileNav } from "@/components/layout/admin-mobile-nav";
import { SidebarLayout } from "@/components/layout/sidebar-layout";
import { TopBar } from "@/components/layout/top-bar";
import { requireAdminPermission } from "@/lib/auth-utils";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { adminCtx: ctx } = await requireAdminPermission("admin:overview");

  return (
    <div className="min-h-screen">
      <SidebarLayout sidebar={<AdminNav permissions={ctx.permissions} />}>
        <TopBar mobileNav={<AdminMobileNav permissions={ctx.permissions} />} />
        <main className="p-6 animate-fade-in-up">{children}</main>
      </SidebarLayout>
    </div>
  );
}

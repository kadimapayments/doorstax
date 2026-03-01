import { TenantNav } from "@/components/layout/tenant-nav";
import { TopBar } from "@/components/layout/top-bar";

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <TenantNav />
      <div className="pl-64">
        <TopBar />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}

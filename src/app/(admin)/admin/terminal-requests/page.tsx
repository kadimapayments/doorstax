import { requireAdminPermission } from "@/lib/auth-utils";
import { PageHeader } from "@/components/ui/page-header";
import { TerminalQueue } from "@/components/admin/terminal-queue";

export const metadata = { title: "Terminal Queue — Admin" };

export default async function AdminTerminalRequestsPage() {
  await requireAdminPermission("admin:landlords");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Terminal Provisioning Queue"
        description="Pending Kadima terminal assignments for newly created properties."
      />
      <TerminalQueue />
    </div>
  );
}

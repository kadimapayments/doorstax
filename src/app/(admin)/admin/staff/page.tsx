import { requireAdminPermission } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StaffTable } from "@/components/admin/staff-table";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";

export const metadata = { title: "Staff — Admin" };

export default async function AdminStaffPage() {
  await requireAdminPermission("admin:staff");

  const staff = await db.adminStaff.findMany({
    include: {
      user: { select: { name: true, email: true, phone: true } },
    },
    orderBy: { invitedAt: "desc" },
  });

  const rows = staff.map((s) => ({
    id: s.id,
    userId: s.userId,
    name: s.user.name,
    email: s.user.email,
    adminRole: s.adminRole,
    isActive: s.isActive,
    invitedAt: s.invitedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Staff"
        description="Manage HQ team members and their permissions."
        actions={
          <Link href="/admin/staff/new">
            <Button size="sm">
              <UserPlus className="mr-2 h-4 w-4" />
              Add Staff
            </Button>
          </Link>
        }
      />
      <StaffTable rows={rows} />
    </div>
  );
}

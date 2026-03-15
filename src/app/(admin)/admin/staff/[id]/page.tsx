import { requireAdminPermission } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { StaffDetailForm } from "@/components/admin/staff-detail-form";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Staff Detail — Admin" };

export default async function StaffDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPermission("admin:staff");
  const { id } = await params;

  const staff = await db.adminStaff.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true } },
    },
  });

  if (!staff) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/staff"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Staff
        </Link>
      </div>
      <StaffDetailForm
        staffId={staff.id}
        name={staff.user.name}
        email={staff.user.email}
        adminRole={staff.adminRole}
        customPermissions={staff.customPermissions}
        isActive={staff.isActive}
      />
    </div>
  );
}

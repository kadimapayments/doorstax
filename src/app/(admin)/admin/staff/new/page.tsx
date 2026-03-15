import { requireAdminPermission } from "@/lib/auth-utils";
import { PageHeader } from "@/components/ui/page-header";
import { AddStaffForm } from "@/components/admin/add-staff-form";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Add Staff — Admin" };

export default async function AddStaffPage() {
  await requireAdminPermission("admin:staff");

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
      <AddStaffForm />
    </div>
  );
}

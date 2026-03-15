import { requireAdminPermission } from "@/lib/auth-utils";
import { PageHeader } from "@/components/ui/page-header";
import { AddLandlordForm } from "@/components/admin/add-landlord-form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Add Manager — Admin" };

export default async function AddLandlordPage() {
  await requireAdminPermission("admin:landlords");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/landlords">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
        </Link>
        <PageHeader title="Add Manager" description="Create a new manager account." />
      </div>
      <AddLandlordForm />
    </div>
  );
}

export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth-utils";
import { getTeamContext, can } from "@/lib/team-context";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Wrench, Plus } from "lucide-react";
import { VendorList } from "@/components/vendors/vendor-list";

export const metadata = { title: "Vendors" };

export default async function VendorsPage() {
  const user = await requireRole("PM");
  const ctx = await getTeamContext(user.id);
  if (!can(ctx, "properties:read")) redirect("/dashboard");

  const vendors = await db.vendor.findMany({
    where: { landlordId: ctx.landlordId },
    include: { tickets: { select: { id: true, status: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendors"
        description="Manage your service vendors and contractors."
        actions={
          <Link href="/dashboard/vendors/add">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Vendor
            </Button>
          </Link>
        }
      />

      {vendors.length === 0 ? (
        <EmptyState
          icon={<Wrench className="h-12 w-12" />}
          title="No vendors yet"
          description="Add your first vendor or contractor to track work orders."
          action={
            <Link href="/dashboard/vendors/add">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Vendor
              </Button>
            </Link>
          }
        />
      ) : (
        <VendorList
          vendors={vendors.map((v) => ({
            id: v.id,
            name: v.name,
            company: v.company,
            email: v.email,
            phone: v.phone,
            category: v.category,
            rating: v.rating,
            isActive: v.isActive,
            openTickets: v.tickets.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS").length,
          }))}
        />
      )}
    </div>
  );
}

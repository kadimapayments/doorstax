import { requireRole } from "@/lib/auth-utils";
import { getTeamContext, can } from "@/lib/team-context";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Wrench, Plus, Star } from "lucide-react";

export const metadata = { title: "Vendors" };

const CATEGORIES: Record<string, string> = {
  PLUMBING: "Plumbing",
  ELECTRICAL: "Electrical",
  HVAC: "HVAC",
  GENERAL: "General",
  ROOFING: "Roofing",
  LANDSCAPING: "Landscaping",
  CLEANING: "Cleaning",
  PEST_CONTROL: "Pest Control",
  PAINTING: "Painting",
  OTHER: "Other",
};

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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vendors.map((vendor) => {
            const openTickets = vendor.tickets.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS").length;
            return (
              <Link key={vendor.id} href={`/dashboard/vendors/${vendor.id}`}>
                <div className="rounded-lg border border-border p-5 hover:border-border/80 transition-colors card-glow">
                  <div className="flex items-center justify-between">
                    <Link href={`/dashboard/vendors/${vendor.id}`} className="font-semibold hover:underline hover:text-primary">
                      {vendor.name}
                    </Link>
                    {vendor.rating && (
                      <div className="flex items-center gap-1 text-amber-500">
                        <Star className="h-3 w-3 fill-current" />
                        <span className="text-xs font-medium">{vendor.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                  {vendor.company && (
                    <p className="text-sm text-muted-foreground">{vendor.company}</p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {CATEGORIES[vendor.category] || vendor.category}
                    </span>
                    {openTickets > 0 && (
                      <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-600">
                        {openTickets} active
                      </span>
                    )}
                    {!vendor.isActive && (
                      <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-600">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground space-y-0.5">
                    {vendor.email && <p>{vendor.email}</p>}
                    {vendor.phone && <p>{vendor.phone}</p>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

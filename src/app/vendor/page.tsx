export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireRole } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Building2, Wrench, Users } from "lucide-react";

export const metadata = { title: "Vendor Portal" };

export default async function VendorDashboardPage() {
  const user = await requireRole("VENDOR");

  // Every Vendor record linked to this user — one per PM they work with.
  const vendorRecords = await db.vendor.findMany({
    where: { userId: user.id },
    include: {
      landlord: {
        select: { id: true, name: true, companyName: true },
      },
      tickets: {
        select: { id: true, status: true },
      },
    },
  });

  const openTickets = vendorRecords.reduce(
    (sum, v) =>
      sum + v.tickets.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS").length,
    0
  );

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 page-enter">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">
          Welcome back, {user.name || "Vendor"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {vendorRecords.length === 0
            ? "You're set up, but no property managers have added you yet."
            : `You're in the network of ${vendorRecords.length} property manager${vendorRecords.length === 1 ? "" : "s"}.`}
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid gap-4 sm:grid-cols-3 animate-stagger">
        <Card className="border-border card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
              <Building2 className="h-4 w-4" />
              <span>Property Managers</span>
            </div>
            <p className="text-2xl font-bold mt-2">{vendorRecords.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
              <Wrench className="h-4 w-4" />
              <span>Open Tickets</span>
            </div>
            <p className="text-2xl font-bold mt-2">{openTickets}</p>
          </CardContent>
        </Card>
        <Card className="border-border card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
              <Users className="h-4 w-4" />
              <span>Profile</span>
            </div>
            <p className="text-sm font-medium mt-2 truncate">{user.email}</p>
          </CardContent>
        </Card>
      </div>

      {/* PM cards */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          My Property Managers
        </h2>
        {vendorRecords.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-12 w-12" />}
            title="No PMs yet"
            description="Once a property manager adds you to their vendor network, they'll appear here with any tickets, invoices, and payments they send your way."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 animate-stagger">
            {vendorRecords.map((v) => {
              const openCount = v.tickets.filter(
                (t) => t.status === "OPEN" || t.status === "IN_PROGRESS"
              ).length;
              return (
                <Card key={v.id} className="border-border card-hover">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">
                          {v.landlord.companyName || v.landlord.name || "Property Manager"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Category: {v.category}
                        </p>
                      </div>
                      {openCount > 0 && (
                        <Badge
                          variant="outline"
                          className="bg-amber-500/10 text-amber-500 border-amber-500/20"
                        >
                          {openCount} open
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-3 mt-3 text-xs text-muted-foreground">
                      <Link
                        href={`/vendor/tickets?pm=${v.landlord.id}`}
                        className="hover:text-foreground hover:underline"
                      >
                        View tickets
                      </Link>
                      <span>·</span>
                      <Link
                        href={`/vendor/invoices?pm=${v.landlord.id}`}
                        className="hover:text-foreground hover:underline"
                      >
                        Invoice
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <p className="text-xs text-muted-foreground pt-4 border-t">
        Your full vendor portal (tickets, invoices, documents, and payouts) is
        rolling out in stages. This dashboard is live — more features coming soon.
      </p>
    </div>
  );
}

import { requireRole } from "@/lib/auth-utils";
import { getTeamContext } from "@/lib/team-context";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { formatCurrency } from "@/lib/utils";
import { Phone, Mail, Building2, Star } from "lucide-react";

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("PM");
  const ctx = await getTeamContext(user.id);
  const { id } = await params;

  const vendor = await db.vendor.findFirst({
    where: { id, landlordId: ctx.landlordId },
    include: {
      tickets: {
        include: {
          unit: { select: { unitNumber: true, property: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
  if (!vendor) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={vendor.name} description={vendor.company || "Vendor details"} />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Info card */}
        <div className="rounded-lg border border-border p-5 space-y-3">
          <h3 className="font-semibold">Contact Info</h3>
          {vendor.email && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" /> {vendor.email}
            </div>
          )}
          {vendor.phone && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4" /> {vendor.phone}
            </div>
          )}
          {vendor.company && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" /> {vendor.company}
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
              {vendor.category.replace(/_/g, " ")}
            </span>
            {vendor.rating && (
              <span className="flex items-center gap-1 text-amber-500">
                <Star className="h-3 w-3 fill-current" /> {vendor.rating.toFixed(1)}
              </span>
            )}
          </div>
          {vendor.notes && <p className="text-sm text-muted-foreground">{vendor.notes}</p>}
        </div>

        {/* Work history */}
        <div className="lg:col-span-2 rounded-lg border border-border p-5">
          <h3 className="font-semibold mb-4">Work History ({vendor.tickets.length})</h3>
          {vendor.tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No work orders assigned yet.</p>
          ) : (
            <div className="space-y-2">
              {vendor.tickets.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.unit?.property?.name} — {t.unit?.unitNumber}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      t.status === "OPEN" ? "bg-blue-500/10 text-blue-600" :
                      t.status === "IN_PROGRESS" ? "bg-yellow-500/10 text-yellow-600" :
                      t.status === "RESOLVED" ? "bg-emerald-500/10 text-emerald-600" :
                      "bg-gray-500/10 text-gray-600"
                    }`}>
                      {t.status}
                    </span>
                    {t.actualCost && (
                      <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(Number(t.actualCost))}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

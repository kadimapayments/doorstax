import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth-utils";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import {
  ArrowLeft, User, Mail, Phone, Building2, Wrench, DollarSign,
  FileText, Star, Receipt, ShieldCheck, Plus, ExternalLink, Briefcase,
} from "lucide-react";
import { CollapsibleList } from "@/components/tenants/collapsible-list";
import { VendorEditButton } from "@/components/vendors/vendor-edit-button";
import { VendorW9Manager } from "@/components/vendors/vendor-w9-manager";

export const metadata = { title: "Vendor Profile" };

export default async function VendorProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("PM");
  const landlordId = await getEffectiveLandlordId(user.id);
  const { id } = await params;

  const vendor = await db.vendor.findFirst({
    where: { id, landlordId },
    include: {
      tickets: {
        include: {
          unit: { select: { unitNumber: true, property: { select: { name: true } } } },
          tenant: { include: { user: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      expenses: {
        include: {
          property: { select: { name: true } },
          unit: { select: { unitNumber: true } },
          tenant: { include: { user: { select: { name: true } } } },
        },
        orderBy: { date: "desc" },
        take: 20,
      },
    },
  });

  if (!vendor) notFound();

  // Aggregate spend stats
  const spendStats = await db.expense.aggregate({
    where: { vendorId: id, landlordId },
    _sum: { amount: true },
    _count: true,
  });

  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const yearSpend = await db.expense.aggregate({
    where: { vendorId: id, landlordId, date: { gte: yearStart } },
    _sum: { amount: true },
    _count: true,
  });

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const monthSpend = await db.expense.aggregate({
    where: { vendorId: id, landlordId, date: { gte: monthStart } },
    _sum: { amount: true },
  });

  const propertiesServed = await db.expense.findMany({
    where: { vendorId: id, landlordId },
    select: { property: { select: { id: true, name: true } } },
    distinct: ["propertyId"],
  });

  const openTickets = vendor.tickets.filter((t) => ["OPEN", "IN_PROGRESS"].includes(t.status)).length;
  const resolvedTickets = vendor.tickets.filter((t) => ["RESOLVED", "CLOSED"].includes(t.status)).length;

  const totalSpend = Number(spendStats._sum.amount || 0);
  const totalJobs = spendStats._count;
  const avgJobCost = totalJobs > 0 ? totalSpend / totalJobs : 0;
  const ytdSpend = Number(yearSpend._sum.amount || 0);
  const mtdSpend = Number(monthSpend._sum.amount || 0);

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/vendors"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Vendors
      </Link>

      <div className="flex items-start justify-between">
        <PageHeader
          title={vendor.name}
          description={vendor.company || vendor.category.replace(/_/g, " ")}
        />
        <div className="flex items-center gap-2">
          <VendorEditButton vendor={{
            id: vendor.id,
            name: vendor.name,
            email: vendor.email,
            phone: vendor.phone,
            company: vendor.company,
            category: vendor.category,
            notes: vendor.notes,
            rating: vendor.rating ? Number(vendor.rating) : null,
            isActive: vendor.isActive,
          }} />
          {vendor.isActive ? (
            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-500">Active</span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">Inactive</span>
          )}
          {vendor.rating && (
            <span className="inline-flex items-center gap-1 text-sm">
              <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
              {vendor.rating}/5
            </span>
          )}
        </div>
      </div>

      {/* Top metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              Total Spend
            </div>
            <p className="text-2xl font-bold">{formatCurrency(totalSpend)}</p>
            <p className="text-xs text-muted-foreground">{totalJobs} job{totalJobs !== 1 ? "s" : ""}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Receipt className="h-4 w-4" />
              This Year
            </div>
            <p className="text-2xl font-bold">{formatCurrency(ytdSpend)}</p>
            <p className="text-xs text-muted-foreground">{yearSpend._count} job{yearSpend._count !== 1 ? "s" : ""}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              This Month
            </div>
            <p className="text-2xl font-bold">{formatCurrency(mtdSpend)}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Wrench className="h-4 w-4" />
              Avg Job Cost
            </div>
            <p className="text-2xl font-bold">{formatCurrency(avgJobCost)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6">
          {/* Contact Info */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {vendor.company && (
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <span>{vendor.company}</span>
                </div>
              )}
              {vendor.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${vendor.email}`} className="text-primary hover:underline">{vendor.email}</a>
                </div>
              )}
              {vendor.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${vendor.phone}`} className="hover:underline">{vendor.phone}</a>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-muted-foreground" />
                <span className="capitalize">{vendor.category.replace(/_/g, " ").toLowerCase()}</span>
              </div>
              {vendor.notes && (
                <div className="pt-2 border-t text-muted-foreground">{vendor.notes}</div>
              )}
              <div className="pt-2 border-t text-xs text-muted-foreground">
                Added {formatDate(vendor.createdAt)}
              </div>
            </CardContent>
          </Card>

          {/* W-9 / Compliance */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                Tax & Compliance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <VendorW9Manager
                vendorId={vendor.id}
                vendorName={vendor.name}
                vendorEmail={vendor.email}
                taxId={vendor.taxId}
                taxIdType={vendor.taxIdType}
                w9Status={vendor.w9Status}
                w9DocumentUrl={vendor.w9DocumentUrl}
                totalSpend={totalSpend}
              />
            </CardContent>
          </Card>

          {/* Properties Served */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                Properties Served
              </CardTitle>
            </CardHeader>
            <CardContent>
              {propertiesServed.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">No properties yet</p>
              ) : (
                <div className="space-y-1">
                  {propertiesServed.map((p) => (
                    <Link key={p.property.id} href={`/dashboard/properties/${p.property.id}`} className="block text-sm text-primary hover:underline py-1">
                      {p.property.name}
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Expense History */}
          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Expense History</CardTitle>
              <Link href={`/dashboard/expenses/new?vendorId=${vendor.id}`}>
                <Button variant="outline" size="sm">
                  <Plus className="mr-1 h-3 w-3" />
                  Add Expense
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {vendor.expenses.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No expenses recorded</p>
              ) : (
                <CollapsibleList
                  label="expenses"
                  initialCount={10}
                  items={vendor.expenses.map((e) => (
                    <div key={e.id} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                      <div>
                        <span className="font-medium">{e.description}</span>
                        <span className="text-muted-foreground ml-2 text-xs">{formatDate(e.date)}</span>
                        <span className="text-muted-foreground ml-2 text-xs">{e.property.name}{e.unit ? ` #${e.unit.unitNumber}` : ""}</span>
                        {e.tenant?.user?.name && (
                          <span className="text-amber-500 ml-2 text-xs">→ {e.tenant.user.name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-xs px-1.5 py-0.5 rounded",
                          e.status === "PAID" ? "bg-emerald-500/10 text-emerald-500" :
                          e.status === "INVOICED" ? "bg-amber-500/10 text-amber-500" :
                          e.status === "APPROVED" ? "bg-blue-500/10 text-blue-500" :
                          "bg-muted text-muted-foreground"
                        )}>
                          {e.status?.charAt(0) + e.status?.slice(1).toLowerCase()}
                        </span>
                        <span className="font-medium">{formatCurrency(Number(e.amount))}</span>
                      </div>
                    </div>
                  ))}
                />
              )}
            </CardContent>
          </Card>

          {/* Service Tickets */}
          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Service Tickets</CardTitle>
              <div className="flex items-center gap-2 text-xs">
                {openTickets > 0 && (
                  <span className="text-amber-500 font-medium">{openTickets} open</span>
                )}
                <span className="text-muted-foreground">{resolvedTickets} resolved</span>
              </div>
            </CardHeader>
            <CardContent>
              {vendor.tickets.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No service tickets</p>
              ) : (
                <CollapsibleList
                  label="tickets"
                  initialCount={10}
                  items={vendor.tickets.map((t) => (
                    <div key={t.id} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                      <div>
                        <span className="font-medium">{t.title}</span>
                        <span className="text-muted-foreground ml-2 text-xs">
                          {t.unit?.property?.name} #{t.unit?.unitNumber}
                        </span>
                        <span className="text-muted-foreground ml-2 text-xs">{formatDate(t.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={t.status} />
                        {t.actualCost && (
                          <span className="text-xs font-medium">{formatCurrency(Number(t.actualCost))}</span>
                        )}
                      </div>
                    </div>
                  ))}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { requireRole } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/ui/page-header";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Download, Eye, FileText, Clock } from "lucide-react";

export const metadata = { title: "My Lease" };

export default async function TenantLeasesPage() {
  const user = await requireRole("TENANT");

  const profile = await db.tenantProfile.findUnique({
    where: { userId: user.id },
  });

  if (!profile) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          Your tenant profile is being set up. Please check back soon.
        </p>
      </div>
    );
  }

  const leases = await db.lease.findMany({
    where: { tenantId: profile.id },
    include: {
      unit: { select: { unitNumber: true, property: { select: { name: true } } } },
      addendums: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lease Agreements"
        description="View your current and past lease agreements."
      />

      {leases.length === 0 ? (
        <Card className="border-border">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No lease agreements found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {leases.map((lease) => (
            <Card key={lease.id} className="border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {lease.unit.property.name} — Unit {lease.unit.unitNumber}
                  </CardTitle>
                  <StatusBadge status={lease.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {lease.status === "PENDING" && (
                  <div className="flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-2.5">
                    <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                      Pending Signature — This lease is awaiting signatures before it becomes active.
                    </span>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Monthly Rent</p>
                    <p className="font-semibold">
                      {formatCurrency(Number(lease.rentAmount))}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Start Date</p>
                    <p className="font-medium">
                      {formatDate(new Date(lease.startDate))}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">End Date</p>
                    <p className="font-medium">
                      {formatDate(new Date(lease.endDate))}
                    </p>
                  </div>
                </div>

                {lease.notes && (
                  <p className="text-sm text-muted-foreground">{lease.notes}</p>
                )}

                {lease.documentUrl && (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={lease.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Eye className="h-4 w-4" />
                        View Document
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={lease.documentUrl} download>
                        <Download className="h-4 w-4" />
                        Download
                      </a>
                    </Button>
                  </div>
                )}

                {/* Addendums */}
                {lease.addendums.length > 0 && (
                  <div className="border-t border-border pt-3">
                    <p className="text-sm font-medium mb-2">Addendums</p>
                    <div className="space-y-2">
                      {lease.addendums.map((a) => (
                        <div
                          key={a.id}
                          className="flex items-start justify-between rounded-md bg-muted/50 p-2"
                        >
                          <div className="space-y-1">
                            <StatusBadge status={a.type} />
                            {a.newRentAmount && (
                              <p className="text-xs">
                                New Rent: {formatCurrency(Number(a.newRentAmount))}
                              </p>
                            )}
                            {a.newEndDate && (
                              <p className="text-xs">
                                New End: {formatDate(new Date(a.newEndDate))}
                              </p>
                            )}
                            {a.notes && (
                              <p className="text-xs text-muted-foreground">{a.notes}</p>
                            )}
                            {a.documentUrl && (
                              <a
                                href={a.documentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                <FileText className="h-3 w-3" />
                                View Document
                              </a>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(new Date(a.createdAt))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

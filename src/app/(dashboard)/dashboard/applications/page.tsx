import Link from "next/link";
import { requireRole } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { FileText, LayoutTemplate } from "lucide-react";
import { ApplicationTable } from "@/components/applications/application-table";
import { InviteToApplyDialog } from "@/components/applications/invite-to-apply-dialog";
import { ApplicationRequestsPipeline } from "@/components/applications/application-requests-pipeline";

export const metadata = { title: "Applications" };

export default async function ApplicationsPage() {
  const user = await requireRole("PM");

  const [applications, applicationRequests] = await Promise.all([
    db.application.findMany({
      where: { unit: { property: { landlordId: user.id } } },
      include: {
        unit: {
          select: { unitNumber: true, property: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.applicationToken.findMany({
      where: { unit: { property: { landlordId: user.id } } },
      include: {
        unit: {
          select: { unitNumber: true, property: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const rows = applications.map((a) => ({
    id: a.id,
    name: a.name,
    email: a.email,
    property: a.unit.property.name,
    unit: a.unit.unitNumber,
    income: Number(a.income),
    status: a.status,
    createdAt: a.createdAt.toISOString(),
  }));

  // Build the set of emails that already submitted an application per unit
  const submittedKeys = new Set(
    applications.map((a) => `${a.email.toLowerCase()}|${a.unitId}`)
  );

  const now = Date.now();
  const requestRows = applicationRequests
    // Filter out tokens whose email has already submitted an application
    .filter(
      (t) => !submittedKeys.has(`${t.email.toLowerCase()}|${t.unitId}`)
    )
    .map((t) => {
      const expired = t.expiresAt.getTime() < now;
      let status: "requested" | "opened" | "expired" = "requested";
      if (expired) status = "expired";
      else if (t.clickedAt) status = "opened";
      return {
        id: t.id,
        email: t.email,
        property: t.unit.property.name,
        unit: t.unit.unitNumber,
        status,
        requestedAt: t.createdAt.toISOString(),
        clickedAt: t.clickedAt?.toISOString() ?? null,
        clickCount: t.clickCount,
        remindersSent: t.remindersSent,
        expiresAt: t.expiresAt.toISOString(),
      };
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Applications"
        description="Review rental applications."
        actions={
          <>
            <InviteToApplyDialog />
            <Link href="/dashboard/applications/templates">
              <Button variant="outline" size="sm">
                <LayoutTemplate className="mr-2 h-4 w-4" />
                Templates
              </Button>
            </Link>
          </>
        }
      />

      {requestRows.length > 0 && (
        <ApplicationRequestsPipeline rows={requestRows} />
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-12 w-12" />}
          title="No applications"
          description="Applications will appear here when tenants apply through your listings."
        />
      ) : (
        <ApplicationTable rows={rows} />
      )}
    </div>
  );
}

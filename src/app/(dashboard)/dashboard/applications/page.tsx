import Link from "next/link";
import { requireRole } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { FileText, LayoutTemplate } from "lucide-react";
import { ApplicationTable } from "@/components/applications/application-table";
import { InviteToApplyDialog } from "@/components/applications/invite-to-apply-dialog";

export const metadata = { title: "Applications" };

export default async function ApplicationsPage() {
  const user = await requireRole("PM");

  const applications = await db.application.findMany({
    where: { unit: { property: { landlordId: user.id } } },
    include: {
      unit: {
        select: { unitNumber: true, property: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

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

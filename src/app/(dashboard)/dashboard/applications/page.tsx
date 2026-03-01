import Link from "next/link";
import { requireRole } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDate } from "@/lib/utils";
import { FileText } from "lucide-react";

export const metadata = { title: "Applications" };

interface AppRow {
  id: string;
  name: string;
  email: string;
  property: string;
  unit: string;
  income: number;
  status: string;
  createdAt: Date;
}

export default async function ApplicationsPage() {
  const user = await requireRole("LANDLORD");

  const applications = await db.application.findMany({
    where: { unit: { property: { landlordId: user.id } } },
    include: {
      unit: {
        select: { unitNumber: true, property: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows: AppRow[] = applications.map((a) => ({
    id: a.id,
    name: a.name,
    email: a.email,
    property: a.unit.property.name,
    unit: a.unit.unitNumber,
    income: Number(a.income),
    status: a.status,
    createdAt: a.createdAt,
  }));

  const columns: Column<AppRow>[] = [
    {
      key: "name",
      header: "Applicant",
      cell: (row) => (
        <Link
          href={`/dashboard/applications/${row.id}`}
          className="font-medium hover:underline"
        >
          {row.name}
        </Link>
      ),
    },
    { key: "email", header: "Email", cell: (row) => <span className="text-muted-foreground">{row.email}</span> },
    { key: "property", header: "Property", cell: (row) => row.property },
    { key: "unit", header: "Unit", cell: (row) => row.unit },
    { key: "income", header: "Income", cell: (row) => formatCurrency(row.income) },
    { key: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
    { key: "date", header: "Date", cell: (row) => formatDate(row.createdAt) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Applications" description="Review rental applications." />

      {rows.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-12 w-12" />}
          title="No applications"
          description="Applications will appear here when tenants apply through your listings."
        />
      ) : (
        <DataTable columns={columns} data={rows} />
      )}
    </div>
  );
}

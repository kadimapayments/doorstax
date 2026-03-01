"use client";

import { useEffect, useState } from "react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/ui/page-header";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Payment {
  id: string;
  amount: string;
  type: string;
  status: string;
  paymentMethod: string | null;
  dueDate: string;
  paidAt: string | null;
  unit: { unitNumber: string; property: { name: string } };
}

export default function LandlordPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetch(`/api/payments?page=${page}`)
      .then((r) => r.json())
      .then((data) => {
        setPayments(data.payments || []);
        setTotalPages(data.meta?.totalPages || 1);
      });
  }, [page]);

  const columns: Column<Payment>[] = [
    {
      key: "property",
      header: "Property",
      cell: (row) => row.unit?.property?.name || "—",
    },
    {
      key: "unit",
      header: "Unit",
      cell: (row) => row.unit?.unitNumber || "—",
    },
    {
      key: "date",
      header: "Due Date",
      cell: (row) => formatDate(new Date(row.dueDate)),
    },
    {
      key: "amount",
      header: "Amount",
      cell: (row) => (
        <span className="font-medium">{formatCurrency(Number(row.amount))}</span>
      ),
    },
    { key: "type", header: "Type", cell: (row) => row.type },
    {
      key: "method",
      header: "Method",
      cell: (row) => row.paymentMethod?.toUpperCase() || "—",
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="All payment activity across your portfolio."
      />
      <DataTable
        columns={columns}
        data={payments}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        emptyMessage="No payments found."
      />
    </div>
  );
}

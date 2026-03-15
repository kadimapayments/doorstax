"use client";

import { useState } from "react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { PaymentMethodBadge } from "@/components/ui/payment-method-badge";
import { TransactionDetailSheet } from "@/components/payments/transaction-detail-sheet";
import { formatCurrency, formatDate } from "@/lib/utils";

export interface PaymentRow {
  id: string;
  tenant: string;
  unit: string;
  amount: number;
  status: string;
  paymentMethod: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  achLast4: string | null;
  date: string; // serialized date
}

export function LandlordPaymentsTable({ rows }: { rows: PaymentRow[] }) {
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);

  const columns: Column<PaymentRow>[] = [
    { key: "tenant", header: "Tenant", cell: (row) => row.tenant },
    { key: "unit", header: "Unit", cell: (row) => row.unit },
    {
      key: "amount",
      header: "Amount",
      cell: (row) => formatCurrency(row.amount),
    },
    {
      key: "method",
      header: "Method",
      cell: (row) => (
        <PaymentMethodBadge
          method={row.paymentMethod}
          cardBrand={row.cardBrand}
          cardLast4={row.cardLast4}
          achLast4={row.achLast4}
        />
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "date",
      header: "Date",
      cell: (row) => formatDate(new Date(row.date)),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        onRowClick={(row) => setSelectedPaymentId(row.id)}
        emptyMessage="No payments yet."
      />
      <TransactionDetailSheet
        paymentId={selectedPaymentId}
        onClose={() => setSelectedPaymentId(null)}
      />
    </>
  );
}

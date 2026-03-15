"use client";

import { useEffect, useState } from "react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { PaymentMethodBadge } from "@/components/ui/payment-method-badge";
import { TransactionDetailSheet } from "@/components/payments/transaction-detail-sheet";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Payment {
  id: string;
  amount: string;
  type: string;
  status: string;
  paymentMethod: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  achLast4: string | null;
  dueDate: string;
  paidAt: string | null;
  unit: { unitNumber: string; property: { name: string } };
}

interface LedgerEntry {
  month: string;
  charge: number;
  paid: number;
  balance: number;
  payments: {
    id: string;
    amount: number;
    status: string;
    paidAt: string | null;
    dueDate: string;
    type: string;
    paymentMethod: string | null;
  }[];
}

interface LedgerData {
  unit: string;
  property: string;
  monthlyCharge: number;
  currentBalance?: number;
  ledger: LedgerEntry[];
}

export default function PaymentHistoryPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [ledgerData, setLedgerData] = useState<LedgerData | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/payments?page=${page}`)
      .then((r) => r.json())
      .then((data) => {
        setPayments(data.payments || []);
        setTotalPages(data.meta?.totalPages || 1);
      });
  }, [page]);

  useEffect(() => {
    setLedgerLoading(true);
    fetch("/api/tenant/ledger")
      .then((r) => r.json())
      .then((data) => {
        setLedgerData(data);
      })
      .catch(() => {
        setLedgerData(null);
      })
      .finally(() => {
        setLedgerLoading(false);
      });
  }, []);

  const columns: Column<Payment>[] = [
    {
      key: "date",
      header: "Due Date",
      cell: (row) => formatDate(new Date(row.dueDate)),
    },
    {
      key: "amount",
      header: "Amount",
      cell: (row) => (
        <span className="font-medium">
          {formatCurrency(Number(row.amount))}
        </span>
      ),
    },
    { key: "type", header: "Type", cell: (row) => row.type },
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
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Payment History" />

      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history">Payment History</TabsTrigger>
          <TabsTrigger value="ledger">Rent Ledger</TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          <DataTable
            columns={columns}
            data={payments}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            onRowClick={(row) => setSelectedPaymentId(row.id)}
            emptyMessage="No payments found."
          />
        </TabsContent>

        <TabsContent value="ledger">
          {ledgerLoading ? (
            <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
              Loading ledger...
            </div>
          ) : !ledgerData ? (
            <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
              Unable to load rent ledger.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Property and unit info */}
              <div className="rounded-lg border border-border p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Property</p>
                    <p className="font-medium">{ledgerData.property}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Unit</p>
                    <p className="font-medium">{ledgerData.unit}</p>
                  </div>
                </div>
                <div className="border-t border-border pt-2 mt-2 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Monthly Charge</p>
                    <p className="text-lg font-semibold">
                      {formatCurrency(ledgerData.monthlyCharge)}
                    </p>
                  </div>
                  {ledgerData.currentBalance !== undefined && (
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Current Balance</p>
                      <p className={`text-lg font-semibold ${
                        ledgerData.currentBalance > 0
                          ? "text-red-500"
                          : ledgerData.currentBalance < 0
                          ? "text-green-500"
                          : "text-foreground"
                      }`}>
                        {formatCurrency(Math.abs(ledgerData.currentBalance))}
                        {ledgerData.currentBalance > 0
                          ? " owed"
                          : ledgerData.currentBalance < 0
                          ? " credit"
                          : ""}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Ledger table */}
              <div className="rounded-lg border border-border card-glow">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead>Month</TableHead>
                      <TableHead>Charge</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledgerData.ledger.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="h-24 text-center text-muted-foreground"
                        >
                          No ledger entries found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      ledgerData.ledger.map((entry) => (
                        <TableRow key={entry.month} className="border-border">
                          <TableCell className="font-medium">
                            {entry.month}
                          </TableCell>
                          <TableCell>{formatCurrency(entry.charge)}</TableCell>
                          <TableCell>{formatCurrency(entry.paid)}</TableCell>
                          <TableCell>
                            <span
                              className={
                                entry.balance > 0
                                  ? "text-red-500 font-medium"
                                  : "text-green-500 font-medium"
                              }
                            >
                              {formatCurrency(entry.balance)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <TransactionDetailSheet
        paymentId={selectedPaymentId}
        onClose={() => setSelectedPaymentId(null)}
      />
    </div>
  );
}

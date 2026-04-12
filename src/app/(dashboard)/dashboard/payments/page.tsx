"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { PaymentMethodBadge } from "@/components/ui/payment-method-badge";
import { TransactionDetailSheet } from "@/components/payments/transaction-detail-sheet";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CreditCard, CalendarClock, Search } from "lucide-react";
import { MonthlyAuthorizationDetail } from "@/components/dashboard/monthly-authorization-detail";

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
  tenant?: { user: { name: string } };
}

const STATUS_OPTIONS = ["All", "COMPLETED", "PENDING", "FAILED", "REFUNDED"];
const TYPE_OPTIONS = ["All", "RENT", "DEPOSIT", "FEE", "APPLICATION"];

function PaymentsContent() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") || "All";

  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [typeFilter, setTypeFilter] = useState("All");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce search input (300ms)
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
  }, []);

  function fetchPayments() {
    const params = new URLSearchParams();
    params.set("page", String(page));
    if (statusFilter !== "All") params.set("status", statusFilter);
    if (typeFilter !== "All") params.set("type", typeFilter);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    if (debouncedSearch) params.set("search", debouncedSearch);

    fetch(`/api/payments?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setPayments(data.payments || []);
        setTotalPages(data.meta?.totalPages || 1);
      });
  }

  useEffect(() => {
    fetchPayments();
  }, [page, statusFilter, typeFilter, fromDate, toDate, debouncedSearch]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, typeFilter, fromDate, toDate, debouncedSearch]);

  const columns: Column<Payment>[] = [
    {
      key: "tenant",
      header: "Tenant",
      cell: (row) => row.tenant?.user?.name || "—",
    },
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
      <MonthlyAuthorizationDetail scope="pm" />

      <PageHeader
        title="Payments"
        description="All payment activity across your portfolio."
        actions={
          <div className="flex gap-2">
            <Link href="/dashboard/payments/charge">
              <Button>
                <CreditCard className="mr-2 h-4 w-4" />
                Charge Tenant
              </Button>
            </Link>
            <Link href="/dashboard/payments/schedule">
              <Button variant="outline">
                <CalendarClock className="mr-2 h-4 w-4" />
                Schedule
              </Button>
            </Link>
          </div>
        }
      />

      {/* Search + Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by tenant, property, or unit..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 max-w-md"
          />
        </div>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === "All" ? "All Statuses" : s.charAt(0) + s.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t === "All" ? "All Types" : t.charAt(0) + t.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-[150px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-[150px]"
            />
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={payments}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onRowClick={(row) => setSelectedPaymentId(row.id)}
        emptyMessage="No payments found."
      />
      <TransactionDetailSheet
        paymentId={selectedPaymentId}
        onClose={() => setSelectedPaymentId(null)}
      />
    </div>
  );
}

export default function LandlordPaymentsPage() {
  return (
    <Suspense>
      <PaymentsContent />
    </Suspense>
  );
}

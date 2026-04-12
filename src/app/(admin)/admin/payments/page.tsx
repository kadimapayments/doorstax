"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback, useMemo } from "react";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { PaymentMethodBadge } from "@/components/ui/payment-method-badge";
import { TransactionDetailSheet } from "@/components/payments/transaction-detail-sheet";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { MonthlyAuthorizationDetail } from "@/components/dashboard/monthly-authorization-detail";

interface PaymentRow {
  id: string;
  createdAt: string;
  landlord: { name: string };
  tenant: { user: { name: string } };
  unit: { unitNumber: string; property: { name: string } };
  amount: string;
  paymentMethod: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  achLast4: string | null;
  status: string;
}

interface Meta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

const statusOptions = ["ALL", "COMPLETED", "PENDING", "FAILED", "REFUNDED"];
const methodOptions = ["ALL", "card", "ach"];

export default function AdminPaymentsPage() {
  const [allPayments, setAllPayments] = useState<PaymentRow[]>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const perPage = 25;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all pages
      let all: PaymentRow[] = [];
      let p = 1;
      let totalPages = 1;
      do {
        const res = await fetch(`/api/admin/payments?page=${p}&perPage=100`);
        const data = await res.json();
        all = [...all, ...data.payments];
        totalPages = data.meta.totalPages;
        p++;
      } while (p <= totalPages);
      setAllPayments(all);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const filtered = useMemo(() => {
    return allPayments.filter((r) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !r.landlord.name.toLowerCase().includes(q) &&
          !r.tenant.user.name.toLowerCase().includes(q) &&
          !r.unit.property.name.toLowerCase().includes(q)
        )
          return false;
      }
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (methodFilter !== "ALL" && r.paymentMethod !== methodFilter) return false;
      return true;
    });
  }, [allPayments, search, statusFilter, methodFilter]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, methodFilter]);

  const totalFilteredVolume = filtered.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="space-y-6">
      <MonthlyAuthorizationDetail scope="admin" />

      <PageHeader
        title="Payments"
        description="All payments across the platform."
      />

      {/* Summary */}
      {!loading && (
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="text-muted-foreground">
            <strong className="text-foreground">{filtered.length}</strong> payments
          </span>
          <span className="text-muted-foreground">
            Total: <strong className="text-foreground">{formatCurrency(totalFilteredVolume)}</strong>
          </span>
          <span className="text-muted-foreground">
            Avg: <strong className="text-foreground">{formatCurrency(filtered.length > 0 ? totalFilteredVolume / filtered.length : 0)}</strong>
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search landlord, tenant, property..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {statusOptions.map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(s)}
            >
              {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
            </Button>
          ))}
        </div>
        <div className="flex gap-1">
          {methodOptions.map((m) => (
            <Button
              key={m}
              variant={methodFilter === m ? "default" : "outline"}
              size="sm"
              onClick={() => setMethodFilter(m)}
            >
              {m === "ALL" ? "All Methods" : m === "card" ? "Card" : "ACH"}
            </Button>
          ))}
        </div>
      </div>

      {loading && allPayments.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          Loading payments...
        </div>
      ) : (
        <div className="rounded-lg border border-border card-glow">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Date</TableHead>
                <TableHead>Landlord</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Property</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No payments match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((row) => (
                  <TableRow
                    key={row.id}
                    className="border-border cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedPaymentId(row.id)}
                  >
                    <TableCell>{formatDate(row.createdAt)}</TableCell>
                    <TableCell>{row.landlord.name}</TableCell>
                    <TableCell>{row.tenant.user.name}</TableCell>
                    <TableCell>{row.unit.property.name} — {row.unit.unitNumber}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(row.amount))}</TableCell>
                    <TableCell>
                      <PaymentMethodBadge
                        method={row.paymentMethod}
                        cardBrand={row.cardBrand}
                        cardLast4={row.cardLast4}
                        achLast4={row.achLast4}
                      />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
      <TransactionDetailSheet
        paymentId={selectedPaymentId}
        onClose={() => setSelectedPaymentId(null)}
      />
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { Search } from "lucide-react";
import Link from "next/link";

export interface LandlordResidualRow {
  id: string;
  name: string;
  properties: number;
  units: number;
  totalVolume: number;
  cardVolume: number;
  cardPercent: number;
  achCount: number;
  cardResidual: number;
  achResidual: number;
  softwareFee: number;
  totalResidual: number;
  tier: string;
  pmCardPayout: number;
  pmAchPayout: number;
  pmTotalPayout: number;
}

interface ResidualsTableProps {
  rows: LandlordResidualRow[];
  selectedMonth?: string;
}

const tierColors: Record<string, string> = {
  Starter: "bg-muted text-muted-foreground",
  Growth: "bg-blue-500/15 text-blue-600 border-blue-500/20",
  Scale: "bg-purple-500/15 text-purple-600 border-purple-500/20",
  Enterprise: "bg-amber-500/15 text-amber-600 border-amber-500/20",
};

export function ResidualsTable({ rows, selectedMonth = "" }: ResidualsTableProps) {
  const [search, setSearch] = useState("");
  const router = useRouter();

  // Generate month options: current month + 11 previous
  const monthOptions = (() => {
    const opts: { label: string; value: string }[] = [];
    const today = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const label = d.toLocaleString("default", { month: "long", year: "numeric" });
      const value = `${year}-${String(month + 1).padStart(2, "0")}`;
      opts.push({ label, value });
    }
    return opts;
  })();

  const filtered = rows.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  const sortedRows = [...filtered].sort(
    (a, b) => b.totalResidual - a.totalResidual
  );

  return (
    <div className="space-y-4">
      {/* Filters row */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter by manager name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={selectedMonth}
          onChange={(e) => {
            const params = new URLSearchParams();
            if (e.target.value) params.set("month", e.target.value);
            router.push(`/admin/residuals${params.toString() ? `?${params.toString()}` : ""}`);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <option value="">All Time</option>
          {monthOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border card-glow overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Manager</TableHead>
              <TableHead className="text-right">Units</TableHead>
              <TableHead className="text-center">Tier</TableHead>
              <TableHead className="text-right">Card Vol</TableHead>
              <TableHead className="text-right">ACH Txns</TableHead>
              <TableHead className="text-right">Card Rev (1%)</TableHead>
              <TableHead className="text-right">ACH Rev</TableHead>
              <TableHead className="text-right">Software Fee</TableHead>
              <TableHead className="text-right">Gross Rev</TableHead>
              <TableHead className="text-right">PM Payout</TableHead>
              <TableHead className="text-right">Net Rev</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={11}
                  className="h-24 text-center text-muted-foreground"
                >
                  {search
                    ? "No managers match your search."
                    : "No earnings data yet."}
                </TableCell>
              </TableRow>
            ) : (
              sortedRows.map((row) => {
                const netRev = row.totalResidual - row.pmTotalPayout;
                return (
                  <TableRow
                    key={row.id}
                    className="border-border cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell>
                      <Link
                        href={`/admin/landlords/${row.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {row.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">{row.units}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={`text-xs ${tierColors[row.tier] || ""}`}
                      >
                        {row.tier}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(row.cardVolume)}
                    </TableCell>
                    <TableCell className="text-right">{row.achCount}</TableCell>
                    <TableCell className="text-right font-medium text-emerald-500">
                      {formatCurrency(row.cardResidual)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-emerald-500">
                      {formatCurrency(row.achResidual)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-blue-500">
                      {formatCurrency(row.softwareFee)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-emerald-500">
                      {formatCurrency(row.totalResidual)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-orange-500">
                      {row.pmTotalPayout > 0
                        ? `-${formatCurrency(row.pmTotalPayout)}`
                        : formatCurrency(0)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-foreground">
                      {formatCurrency(netRev)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
            {/* Totals row */}
            {sortedRows.length > 0 && (
              <TableRow className="border-border bg-muted/30 font-semibold">
                <TableCell>Platform Total</TableCell>
                <TableCell className="text-right">
                  {sortedRows.reduce((s, r) => s + r.units, 0)}
                </TableCell>
                <TableCell />
                <TableCell className="text-right">
                  {formatCurrency(
                    sortedRows.reduce((s, r) => s + r.cardVolume, 0)
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {sortedRows.reduce((s, r) => s + r.achCount, 0)}
                </TableCell>
                <TableCell className="text-right font-bold text-emerald-500">
                  {formatCurrency(
                    sortedRows.reduce((s, r) => s + r.cardResidual, 0)
                  )}
                </TableCell>
                <TableCell className="text-right font-bold text-emerald-500">
                  {formatCurrency(
                    sortedRows.reduce((s, r) => s + r.achResidual, 0)
                  )}
                </TableCell>
                <TableCell className="text-right font-bold text-blue-500">
                  {formatCurrency(
                    sortedRows.reduce((s, r) => s + r.softwareFee, 0)
                  )}
                </TableCell>
                <TableCell className="text-right font-bold text-emerald-500">
                  {formatCurrency(
                    sortedRows.reduce((s, r) => s + r.totalResidual, 0)
                  )}
                </TableCell>
                <TableCell className="text-right font-bold text-orange-500">
                  {`-${formatCurrency(
                    sortedRows.reduce((s, r) => s + r.pmTotalPayout, 0)
                  )}`}
                </TableCell>
                <TableCell className="text-right font-bold text-foreground">
                  {formatCurrency(
                    sortedRows.reduce(
                      (s, r) => s + (r.totalResidual - r.pmTotalPayout),
                      0
                    )
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

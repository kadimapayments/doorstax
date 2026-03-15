"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";
import { RiskDetailPanel } from "@/components/admin/risk-detail-panel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface RiskRow {
  id: string;
  landlord: string;
  tenant: string;
  unit: string;
  amount: number;
  status: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  failureCount: number;
  date: string;
}

export function RiskTable({ rows }: { rows: RiskRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="rounded-lg border border-border card-glow">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="w-8" />
            <TableHead>Severity</TableHead>
            <TableHead>Landlord</TableHead>
            <TableHead>Tenant</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Failures</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                No flagged transactions.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const isExpanded = expandedId === row.id;
              return (
                <>
                  <TableRow
                    key={row.id}
                    className="border-border cursor-pointer hover:bg-muted/50"
                    onClick={() => setExpandedId(isExpanded ? null : row.id)}
                    role="button"
                  >
                    <TableCell className="w-8">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell><SeverityBadge severity={row.severity} /></TableCell>
                    <TableCell>{row.landlord}</TableCell>
                    <TableCell>{row.tenant}</TableCell>
                    <TableCell>{row.unit}</TableCell>
                    <TableCell>{formatCurrency(row.amount)}</TableCell>
                    <TableCell><StatusBadge status={row.status} /></TableCell>
                    <TableCell>{row.failureCount}</TableCell>
                    <TableCell>{formatDate(new Date(row.date))}</TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow key={`${row.id}-detail`} className="border-border">
                      <TableCell colSpan={9} className="p-0">
                        <div className="p-4">
                          <RiskDetailPanel paymentId={row.id} />
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

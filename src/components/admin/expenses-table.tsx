"use client";

import { useState } from "react";
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
import { formatCurrency, formatDate } from "@/lib/utils";
import { Search, ChevronDown, ChevronRight, ExternalLink, Repeat } from "lucide-react";

interface ExpenseRow {
  id: string;
  landlordId: string;
  landlordName: string;
  property: string;
  unit: string | null;
  category: string;
  amount: number;
  date: string;
  description: string;
  vendor: string | null;
  recurring: boolean;
  receiptUrl: string | null;
}

interface ExpensesTableProps {
  rows: ExpenseRow[];
  landlords: { id: string; name: string }[];
  properties: string[];
  categories: string[];
}

function getCategoryColor(category: string) {
  switch (category) {
    case "MAINTENANCE":
      return "bg-amber-500/15 text-amber-500 border-amber-500/20";
    case "MORTGAGE":
      return "bg-blue-500/15 text-blue-500 border-blue-500/20";
    case "INSURANCE":
      return "bg-purple-500/15 text-purple-500 border-purple-500/20";
    case "TAXES":
      return "bg-red-500/15 text-red-500 border-red-500/20";
    case "PAYROLL":
      return "bg-emerald-500/15 text-emerald-500 border-emerald-500/20";
    case "SERVICES":
      return "bg-cyan-500/15 text-cyan-500 border-cyan-500/20";
    case "UPGRADES":
      return "bg-indigo-500/15 text-indigo-500 border-indigo-500/20";
    case "PROCESSING_FEES":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function ExpensesTable({ rows, landlords, properties, categories }: ExpensesTableProps) {
  const [search, setSearch] = useState("");
  const [landlordFilter, setLandlordFilter] = useState("ALL");
  const [propertyFilter, setPropertyFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = rows.filter((r) => {
    const matchesSearch =
      !search ||
      r.description.toLowerCase().includes(search.toLowerCase()) ||
      (r.vendor && r.vendor.toLowerCase().includes(search.toLowerCase())) ||
      r.landlordName.toLowerCase().includes(search.toLowerCase());

    const matchesLandlord =
      landlordFilter === "ALL" || r.landlordId === landlordFilter;

    const matchesProperty =
      propertyFilter === "ALL" || r.property === propertyFilter;

    const matchesCategory =
      categoryFilter === "ALL" || r.category === categoryFilter;

    return matchesSearch && matchesLandlord && matchesProperty && matchesCategory;
  });

  const filteredTotal = filtered.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search description, vendor, manager..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <select
          value={landlordFilter}
          onChange={(e) => setLandlordFilter(e.target.value)}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="ALL">All Managers</option>
          {landlords.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>

        <select
          value={propertyFilter}
          onChange={(e) => setPropertyFilter(e.target.value)}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="ALL">All Properties</option>
          {properties.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="ALL">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c.replace("_", " ")}
            </option>
          ))}
        </select>

        <span className="text-sm text-muted-foreground">
          {filtered.length} expense{filtered.length !== 1 ? "s" : ""} · {formatCurrency(filteredTotal)}
        </span>
      </div>

      <div className="rounded-lg border border-border card-glow">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="w-8" />
              <TableHead>Date</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead>Property</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-center">Recurring</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  {search || landlordFilter !== "ALL" || propertyFilter !== "ALL" || categoryFilter !== "ALL"
                    ? "No expenses match your filters."
                    : "No expenses recorded."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => {
                const isExpanded = expandedId === row.id;
                return (
                  <>
                    <TableRow
                      key={row.id}
                      className="border-border cursor-pointer hover:bg-muted/50"
                      onClick={() => setExpandedId(isExpanded ? null : row.id)}
                    >
                      <TableCell className="w-8">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {formatDate(new Date(row.date))}
                      </TableCell>
                      <TableCell className="font-medium">{row.landlordName}</TableCell>
                      <TableCell>{row.property}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getCategoryColor(row.category)}>
                          {row.category.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{row.description}</TableCell>
                      <TableCell className="text-muted-foreground">{row.vendor ?? "—"}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(row.amount)}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.recurring && <Repeat className="h-4 w-4 text-blue-500 mx-auto" />}
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${row.id}-detail`} className="border-border">
                        <TableCell colSpan={9} className="p-0">
                          <div className="bg-muted/30 p-4 space-y-2">
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                              <div>
                                <p className="text-muted-foreground">Full Description</p>
                                <p className="font-medium">{row.description}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Property / Unit</p>
                                <p className="font-medium">
                                  {row.property}{row.unit ? ` — Unit ${row.unit}` : ""}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Recurring</p>
                                <p className="font-medium">{row.recurring ? "Yes" : "No"}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Receipt</p>
                                {row.receiptUrl ? (
                                  <a
                                    href={row.receiptUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline flex items-center gap-1"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    View Receipt <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : (
                                  <p className="text-muted-foreground">No receipt</p>
                                )}
                              </div>
                            </div>
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
    </div>
  );
}

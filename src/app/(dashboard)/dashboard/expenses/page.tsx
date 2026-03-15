"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SortableHeader, toggleSort, sortCompare, type SortDir } from "@/components/ui/sortable-header";
import Image from "next/image";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Plus,
  DollarSign,
  Trash2,
  Calculator,
  ChevronDown,
  ChevronUp,
  Pencil,
  X,
  Save,
  ExternalLink,
  FileImage,
  Paperclip,
} from "lucide-react";
import { toast } from "sonner";
import { PaginationControls } from "@/components/ui/pagination-controls";

interface ExpenseRow {
  id: string;
  propertyId: string;
  category: string;
  amount: string | number;
  date: string;
  description: string;
  vendor: string | null;
  recurring: boolean;
  receiptUrl: string | null;
  property: { name: string };
  unit: { unitNumber: string } | null;
  isProcessingFee?: boolean;
}

interface PropertyItem {
  id: string;
  name: string;
}

const CATEGORIES = [
  "All",
  "SERVICES",
  "UPGRADES",
  "TAXES",
  "MORTGAGE",
  "INSURANCE",
  "MAINTENANCE",
  "PAYROLL",
  "PROCESSING_FEES",
  "OTHER",
];

const EDITABLE_CATEGORIES = [
  "SERVICES",
  "UPGRADES",
  "TAXES",
  "MORTGAGE",
  "INSURANCE",
  "MAINTENANCE",
  "PAYROLL",
  "OTHER",
];

const columnCount = 8; // chevron + date + property + category + description + vendor + amount + actions

function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/i.test(url);
}

function formatCategory(cat: string): string {
  if (cat === "PROCESSING_FEES") return "Payment Processing";
  return cat.charAt(0) + cat.slice(1).toLowerCase();
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [processingFeeTotal, setProcessingFeeTotal] = useState(0);

  // Expandable + Edit state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editVendor, setEditVendor] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editRecurring, setEditRecurring] = useState(false);
  const [editReceiptUrl, setEditReceiptUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: string) {
    const s = toggleSort(key, sortCol, sortDir);
    setSortCol(s.sort);
    setSortDir(s.dir);
  }

  function fetchExpenses() {
    setPage(1);
    setExpandedId(null);
    setEditingId(null);
    const params = new URLSearchParams();
    if (propertyFilter && propertyFilter !== "all") params.set("propertyId", propertyFilter);
    if (categoryFilter !== "All") params.set("category", categoryFilter);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);

    fetch(`/api/expenses?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && data.expenses) {
          setExpenses(Array.isArray(data.expenses) ? data.expenses : []);
          setProcessingFeeTotal(data.processingFeeTotal || 0);
        } else {
          setExpenses(Array.isArray(data) ? data : []);
          setProcessingFeeTotal(0);
        }
      });
  }

  useEffect(() => {
    fetch("/api/properties")
      .then((r) => r.json())
      .then((data) =>
        setProperties(
          (data || []).map((p: { id: string; name: string }) => ({
            id: p.id,
            name: p.name,
          }))
        )
      );
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [propertyFilter, categoryFilter, fromDate, toDate]);

  function toggleExpanded(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
    if (editingId && editingId !== id) {
      setEditingId(null);
    }
  }

  function startEdit(row: ExpenseRow) {
    setEditingId(row.id);
    setEditAmount(String(row.amount));
    setEditDescription(row.description);
    setEditVendor(row.vendor || "");
    setEditCategory(row.category);
    setEditDate(new Date(row.date).toISOString().split("T")[0]);
    setEditRecurring(row.recurring);
    setEditReceiptUrl(row.receiptUrl || "");
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function handleSave(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(editAmount),
          description: editDescription,
          vendor: editVendor || undefined,
          category: editCategory,
          date: editDate,
          recurring: editRecurring,
          receiptUrl: editReceiptUrl || undefined,
        }),
      });
      if (res.ok) {
        toast.success("Expense updated");
        setEditingId(null);
        fetchExpenses();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleReceiptUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "receipts");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) {
        setEditReceiptUrl(data.url);
        toast.success("Receipt uploaded");
      } else {
        toast.error(data.error || "Upload failed");
      }
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this expense?")) return;
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Expense deleted");
        if (expandedId === id) setExpandedId(null);
        fetchExpenses();
      } else {
        toast.error("Failed to delete expense");
      }
    } catch {
      toast.error("Something went wrong");
    }
  }

  const totalExpenses = expenses.reduce(
    (sum, e) => sum + Number(e.amount),
    0
  );

  const sorted = useMemo(() => {
    if (!sortCol) return expenses;
    return [...expenses].sort((a, b) => {
      let aVal: unknown, bVal: unknown;
      switch (sortCol) {
        case "date":
          aVal = new Date(a.date).getTime();
          bVal = new Date(b.date).getTime();
          break;
        case "amount":
          aVal = Number(a.amount);
          bVal = Number(b.amount);
          break;
        case "category":
          aVal = a.category;
          bVal = b.category;
          break;
        case "vendor":
          aVal = a.vendor || "";
          bVal = b.vendor || "";
          break;
        case "description":
          aVal = a.description;
          bVal = b.description;
          break;
        default:
          return 0;
      }
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === "number" && typeof bVal === "number")
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return sortDir === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [expenses, sortCol, sortDir]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description="Track and manage property expenses."
        actions={
          <Link href="/dashboard/expenses/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Expense
            </Button>
          </Link>
        }
      />

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label="Total Expenses"
          value={formatCurrency(totalExpenses)}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <MetricCard
          label="Payment Processing"
          value={formatCurrency(processingFeeTotal)}
          icon={<Calculator className="h-4 w-4" />}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Property</Label>
          <Select value={propertyFilter} onValueChange={setPropertyFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Properties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Properties</SelectItem>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Category</Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c === "All"
                    ? "All"
                    : c === "PROCESSING_FEES"
                      ? "Payment Processing"
                      : c.charAt(0) + c.slice(1).toLowerCase()}
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

      {/* Expandable Expenses Table */}
      <div className="rounded-lg border border-border card-glow">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="w-10" />
              <SortableHeader label="Date" sortKey="date" currentSort={sortCol} currentDir={sortDir} onSort={handleSort} />
              <TableHead>Property</TableHead>
              <SortableHeader label="Category" sortKey="category" currentSort={sortCol} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Description" sortKey="description" currentSort={sortCol} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Vendor" sortKey="vendor" currentSort={sortCol} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Amount" sortKey="amount" currentSort={sortCol} currentDir={sortDir} onSort={handleSort} />
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columnCount}
                  className="h-24 text-center text-muted-foreground"
                >
                  No expenses found.
                </TableCell>
              </TableRow>
            ) : (
              sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((row) => {
                const isExpanded = expandedId === row.id;
                const isEditing = editingId === row.id;
                const isProcessingFee = !!row.isProcessingFee;

                return (
                  <ExpandableExpenseRow
                    key={row.id}
                    row={row}
                    isExpanded={isExpanded}
                    isEditing={isEditing}
                    isProcessingFee={isProcessingFee}
                    onToggle={() => !isProcessingFee && toggleExpanded(row.id)}
                    onEdit={() => startEdit(row)}
                    onCancelEdit={cancelEdit}
                    onSave={() => handleSave(row.id)}
                    onDelete={() => handleDelete(row.id)}
                    // Edit state
                    editAmount={editAmount}
                    setEditAmount={setEditAmount}
                    editDescription={editDescription}
                    setEditDescription={setEditDescription}
                    editVendor={editVendor}
                    setEditVendor={setEditVendor}
                    editCategory={editCategory}
                    setEditCategory={setEditCategory}
                    editDate={editDate}
                    setEditDate={setEditDate}
                    editRecurring={editRecurring}
                    setEditRecurring={setEditRecurring}
                    editReceiptUrl={editReceiptUrl}
                    onReceiptUpload={handleReceiptUpload}
                    uploading={uploading}
                    saving={saving}
                  />
                );
              })
            )}
          </TableBody>
        </Table>
        {Math.ceil(sorted.length / PAGE_SIZE) > 1 && (
          <PaginationControls page={page} totalPages={Math.ceil(sorted.length / PAGE_SIZE)} onPageChange={(p) => { setPage(p); setExpandedId(null); setEditingId(null); }} />
        )}
      </div>
    </div>
  );
}

/* ── Expandable Expense Row ─────────────────────────────── */

interface ExpandableExpenseRowProps {
  row: ExpenseRow;
  isExpanded: boolean;
  isEditing: boolean;
  isProcessingFee: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onDelete: () => void;
  editAmount: string;
  setEditAmount: (v: string) => void;
  editDescription: string;
  setEditDescription: (v: string) => void;
  editVendor: string;
  setEditVendor: (v: string) => void;
  editCategory: string;
  setEditCategory: (v: string) => void;
  editDate: string;
  setEditDate: (v: string) => void;
  editRecurring: boolean;
  setEditRecurring: (v: boolean) => void;
  editReceiptUrl: string;
  onReceiptUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploading: boolean;
  saving: boolean;
}

function ExpandableExpenseRow({
  row,
  isExpanded,
  isEditing,
  isProcessingFee,
  onToggle,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
  editAmount,
  setEditAmount,
  editDescription,
  setEditDescription,
  editVendor,
  setEditVendor,
  editCategory,
  setEditCategory,
  editDate,
  setEditDate,
  editRecurring,
  setEditRecurring,
  editReceiptUrl,
  onReceiptUpload,
  uploading,
  saving,
}: ExpandableExpenseRowProps) {
  return (
    <>
      {/* Main row */}
      <TableRow
        className={`border-border ${
          isProcessingFee
            ? ""
            : "cursor-pointer hover:bg-muted/50"
        }`}
        onClick={isProcessingFee ? undefined : onToggle}
        role={isProcessingFee ? undefined : "button"}
        aria-expanded={isProcessingFee ? undefined : isExpanded}
      >
        {/* Chevron */}
        <TableCell className="w-10 px-2">
          {!isProcessingFee && (
            <Button
              variant="ghost"
              size="icon-xs"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              aria-label={isExpanded ? "Collapse row" : "Expand row"}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          )}
        </TableCell>

        {/* Date */}
        <TableCell>{formatDate(new Date(row.date))}</TableCell>

        {/* Property */}
        <TableCell>
          {row.unit
            ? `${row.property.name} #${row.unit.unitNumber}`
            : row.property.name}
        </TableCell>

        {/* Category */}
        <TableCell>
          {row.category === "PROCESSING_FEES" ? (
            <span className="inline-flex items-center gap-1">
              Payment Processing
              <span className="inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                Auto
              </span>
            </span>
          ) : (
            formatCategory(row.category)
          )}
        </TableCell>

        {/* Description */}
        <TableCell>
          <span className="inline-flex items-center gap-1.5">
            {isProcessingFee && (
              <Calculator className="h-3.5 w-3.5 text-blue-500 shrink-0" />
            )}
            {!isProcessingFee && row.receiptUrl && (
              <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            )}
            <span className="truncate max-w-[200px]">{row.description}</span>
          </span>
        </TableCell>

        {/* Vendor */}
        <TableCell>{row.vendor || "\u2014"}</TableCell>

        {/* Amount */}
        <TableCell>
          <span className="font-medium">
            {formatCurrency(Number(row.amount))}
          </span>
        </TableCell>

        {/* Actions */}
        <TableCell>
          {isProcessingFee ? (
            <Button variant="ghost" size="sm" disabled title="Auto-calculated fee">
              <Trash2 className="h-4 w-4 text-muted-foreground opacity-30" />
            </Button>
          ) : (
            <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (!isExpanded) onToggle();
                  onEdit();
                }}
                title="Edit expense"
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                title="Delete expense"
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          )}
        </TableCell>
      </TableRow>

      {/* Expanded detail row */}
      {isExpanded && !isProcessingFee && (
        <TableRow className="border-border hover:bg-transparent">
          <TableCell colSpan={columnCount} className="p-0">
            <div className="bg-muted/30 border-t border-border px-6 py-4">
              {isEditing ? (
                /* ─── Edit Mode ─── */
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Amount ($) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Date *</Label>
                      <Input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Category *</Label>
                      <Select value={editCategory} onValueChange={setEditCategory}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EDITABLE_CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c.charAt(0) + c.slice(1).toLowerCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Description *</Label>
                      <Input
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Vendor</Label>
                      <Input
                        value={editVendor}
                        onChange={(e) => setEditVendor(e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`recurring-${row.id}`}
                      checked={editRecurring}
                      onChange={(e) => setEditRecurring(e.target.checked)}
                      className="h-4 w-4 rounded border-input"
                    />
                    <Label htmlFor={`recurring-${row.id}`} className="text-sm font-normal">
                      Recurring expense
                    </Label>
                  </div>

                  {/* Receipt upload */}
                  <div className="space-y-2">
                    <Label className="text-xs">Receipt / Proof</Label>
                    {editReceiptUrl && (
                      <div className="flex items-center gap-2">
                        {isImageUrl(editReceiptUrl) ? (
                          <a href={editReceiptUrl} target="_blank" rel="noopener noreferrer">
                            <Image
                              src={editReceiptUrl}
                              alt="Receipt"
                              width={80}
                              height={80}
                              className="rounded border border-border object-cover"
                            />
                          </a>
                        ) : (
                          <a
                            href={editReceiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                          >
                            <FileImage className="h-4 w-4" />
                            View current receipt
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        <span className="text-xs text-emerald-500">Attached</span>
                      </div>
                    )}
                    <Input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={onReceiptUpload}
                      disabled={uploading}
                    />
                    {uploading && (
                      <p className="text-xs text-muted-foreground">Uploading...</p>
                    )}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={onSave} disabled={saving}>
                      <Save className="mr-1.5 h-3.5 w-3.5" />
                      {saving ? "Saving..." : "Save"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={onCancelEdit}>
                      <X className="mr-1.5 h-3.5 w-3.5" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                /* ─── Display Mode ─── */
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Description
                      </p>
                      <p className="mt-1 text-sm">{row.description}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Vendor
                      </p>
                      <p className="mt-1 text-sm">{row.vendor || "\u2014"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Category
                      </p>
                      <p className="mt-1 text-sm">{formatCategory(row.category)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Recurring
                      </p>
                      <p className="mt-1 text-sm">{row.recurring ? "Yes" : "No"}</p>
                    </div>
                  </div>

                  {/* Receipt / Proof Section */}
                  <div className="rounded-lg border border-border bg-background p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                      Receipt / Proof
                    </p>
                    {row.receiptUrl ? (
                      <div className="flex items-start gap-4">
                        {isImageUrl(row.receiptUrl) ? (
                          <a href={row.receiptUrl} target="_blank" rel="noopener noreferrer">
                            <Image
                              src={row.receiptUrl}
                              alt="Receipt"
                              width={120}
                              height={120}
                              className="rounded border border-border object-cover hover:opacity-80 transition-opacity"
                            />
                          </a>
                        ) : (
                          <div className="flex h-[120px] w-[120px] items-center justify-center rounded border border-border bg-muted">
                            <FileImage className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                        <div className="space-y-2">
                          <a
                            href={row.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                          >
                            View Receipt
                            <ExternalLink className="h-3 w-3" />
                          </a>
                          <p className="text-xs text-muted-foreground">
                            Click to view full size in a new tab
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No receipt attached. Click Edit to upload one.
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onEdit}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onDelete}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

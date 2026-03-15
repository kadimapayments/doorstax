"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import * as XLSX from "xlsx-js-style";
import { downloadTenantImportTemplate } from "@/lib/generate-tenant-import-template";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Upload,
  FileSpreadsheet,
  Check,
  AlertCircle,
  ArrowLeft,
  Building2,
  Users,
  Download,
} from "lucide-react";
import Link from "next/link";

interface ParsedRow {
  name: string;
  email: string;
  phone?: string;
  propertyName: string;
  unitNumber: string;
  leaseStart?: string;
  leaseEnd?: string;
  splitPercent?: number;
}

interface GroupedUnit {
  propertyName: string;
  unitNumber: string;
  tenants: ParsedRow[];
}

const EXPECTED_COLUMNS = [
  "name",
  "email",
  "phone",
  "propertyName",
  "unitNumber",
  "leaseStart",
  "leaseEnd",
  "splitPercent",
];

const COLUMN_ALIASES: Record<string, string> = {
  "name": "name",
  "full name": "name",
  "tenant name": "name",
  "tenant": "name",
  "email": "email",
  "e-mail": "email",
  "email address": "email",
  "phone": "phone",
  "phone number": "phone",
  "mobile": "phone",
  "cell": "phone",
  "property": "propertyName",
  "property name": "propertyName",
  "unit": "unitNumber",
  "unit number": "unitNumber",
  "unit #": "unitNumber",
  "apt": "unitNumber",
  "lease start": "leaseStart",
  "start date": "leaseStart",
  "move in": "leaseStart",
  "lease end": "leaseEnd",
  "end date": "leaseEnd",
  "move out": "leaseEnd",
  "split": "splitPercent",
  "rent split": "splitPercent",
  "rent split %": "splitPercent",
  "split %": "splitPercent",
  "split percent": "splitPercent",
};

function normalizeColumnName(header: string): string {
  const lower = header.trim().toLowerCase();
  return COLUMN_ALIASES[lower] || lower;
}

export default function ImportTenantsPage() {
  const router = useRouter();
  const [step, setStep] = useState<"upload" | "mapping" | "preview" | "result">("upload");
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [grouped, setGrouped] = useState<GroupedUnit[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    tenantsCreated: number;
    tenantsSkipped: number;
  } | null>(null);

  const handleFile = useCallback((file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const headers = results.meta.fields || [];
          processRawData(headers, results.data as Record<string, string>[]);
        },
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
          defval: "",
        });
        if (json.length > 0) {
          const headers = Object.keys(json[0]);
          processRawData(headers, json);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setErrors(["Unsupported file type. Please upload a .csv, .xlsx, or .xls file."]);
    }
  }, []);

  function processRawData(headers: string[], rows: Record<string, string>[]) {
    setRawHeaders(headers);
    setRawRows(rows);

    // Auto-map columns
    const autoMap: Record<string, string> = {};
    for (const header of headers) {
      const normalized = normalizeColumnName(header);
      if (EXPECTED_COLUMNS.includes(normalized)) {
        autoMap[header] = normalized;
      }
    }
    setColumnMapping(autoMap);
    setStep("mapping");
  }

  function applyMapping() {
    const mapped: ParsedRow[] = [];
    const errs: string[] = [];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    for (let i = 0; i < rawRows.length; i++) {
      const raw = rawRows[i];
      const row: Record<string, string> = {};

      for (const [sourceCol, targetCol] of Object.entries(columnMapping)) {
        if (targetCol && raw[sourceCol] !== undefined) {
          row[targetCol] = String(raw[sourceCol]).trim();
        }
      }

      if (!row.name) {
        errs.push(`Row ${i + 1}: Missing tenant name`);
        continue;
      }
      if (!row.email) {
        errs.push(`Row ${i + 1}: Missing email`);
        continue;
      }
      if (!emailRegex.test(row.email)) {
        errs.push(`Row ${i + 1}: Invalid email format`);
        continue;
      }
      if (!row.propertyName) {
        errs.push(`Row ${i + 1}: Missing property name`);
        continue;
      }
      if (!row.unitNumber) {
        errs.push(`Row ${i + 1}: Missing unit number`);
        continue;
      }

      mapped.push({
        name: row.name,
        email: row.email,
        phone: row.phone || undefined,
        propertyName: row.propertyName,
        unitNumber: row.unitNumber,
        leaseStart: row.leaseStart || undefined,
        leaseEnd: row.leaseEnd || undefined,
        splitPercent: row.splitPercent ? parseFloat(row.splitPercent) : undefined,
      });
    }

    setErrors(errs);
    setParsedRows(mapped);

    // Group by property + unit
    const groupMap = new Map<string, GroupedUnit>();
    for (const row of mapped) {
      const key = `${row.propertyName}|||${row.unitNumber}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          propertyName: row.propertyName,
          unitNumber: row.unitNumber,
          tenants: [],
        });
      }
      groupMap.get(key)!.tenants.push(row);
    }
    setGrouped(Array.from(groupMap.values()));
    setStep("preview");
  }

  async function handleImport() {
    setImporting(true);
    try {
      const res = await fetch("/api/tenants/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: parsedRows }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.errors) {
          setErrors(data.errors.map((e: { row: number; message: string }) => `Row ${e.row}: ${e.message}`));
        } else {
          setErrors([data.error || "Import failed"]);
        }
        return;
      }

      setResult(data);
      setStep("result");
    } catch {
      setErrors(["Network error. Please try again."]);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import Tenants"
        description="Upload a CSV or Excel file to bulk-add tenants to your properties."
        actions={
          <Link href="/dashboard/tenants">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
        }
      />

      {/* Step 1: Upload */}
      {step === "upload" && (
        <Card className="border-border">
          <CardContent className="pt-6">
            <div
              className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-12 cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => document.getElementById("file-input")?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files[0];
                if (file) handleFile(file);
              }}
            >
              <Upload className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">
                Drop your file here or click to browse
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Supports .csv, .xlsx, .xls
              </p>
              <input
                id="file-input"
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </div>

            <div className="mt-6 rounded-lg bg-muted p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium">Need a template?</p>
                  <p className="text-xs text-muted-foreground">
                    Download our pre-formatted Excel template with example data.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadTenantImportTemplate();
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Template
                </Button>
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Required columns:
                </p>
                <p className="text-xs text-muted-foreground">
                  Name, Email, Property Name, Unit Number
                </p>
                <p className="text-xs font-medium text-muted-foreground mt-2 mb-1">
                  Optional columns:
                </p>
                <p className="text-xs text-muted-foreground">
                  Phone, Lease Start, Lease End, Rent Split %
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Column Mapping */}
      {step === "mapping" && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">
              Map Columns ({rawRows.length} rows detected)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Verify that your columns are mapped correctly. Columns marked with * are required.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rawHeaders.map((header) => (
                <div key={header} className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {header}
                  </label>
                  <select
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={columnMapping[header] || ""}
                    onChange={(e) =>
                      setColumnMapping((prev) => ({
                        ...prev,
                        [header]: e.target.value,
                      }))
                    }
                  >
                    <option value="">— Skip —</option>
                    <option value="name">Name *</option>
                    <option value="email">Email *</option>
                    <option value="phone">Phone</option>
                    <option value="propertyName">Property Name *</option>
                    <option value="unitNumber">Unit Number *</option>
                    <option value="leaseStart">Lease Start</option>
                    <option value="leaseEnd">Lease End</option>
                    <option value="splitPercent">Rent Split %</option>
                  </select>
                </div>
              ))}
            </div>

            <div className="mt-6 flex gap-2">
              <Button onClick={applyMapping}>Continue to Preview</Button>
              <Button variant="outline" onClick={() => setStep("upload")}>
                Start Over
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview */}
      {step === "preview" && (
        <>
          {errors.length > 0 && (
            <Card className="border-destructive bg-destructive/5">
              <CardContent className="pt-6">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive">
                      {errors.length} row(s) skipped due to errors:
                    </p>
                    <ul className="mt-1 space-y-1 text-sm text-destructive/80">
                      {errors.slice(0, 10).map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                      {errors.length > 10 && (
                        <li>... and {errors.length - 10} more</li>
                      )}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="border-border">
              <CardContent className="pt-6 text-center">
                <Building2 className="h-8 w-8 mx-auto text-primary mb-2" />
                <p className="text-2xl font-bold">
                  {new Set(grouped.map((g) => g.propertyName)).size}
                </p>
                <p className="text-sm text-muted-foreground">Properties</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="pt-6 text-center">
                <Users className="h-8 w-8 mx-auto text-primary mb-2" />
                <p className="text-2xl font-bold">{parsedRows.length}</p>
                <p className="text-sm text-muted-foreground">Tenants</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="pt-6 text-center">
                <FileSpreadsheet className="h-8 w-8 mx-auto text-primary mb-2" />
                <p className="text-2xl font-bold">{rawRows.length}</p>
                <p className="text-sm text-muted-foreground">Total Rows</p>
              </CardContent>
            </Card>
          </div>

          {grouped.map((group, idx) => (
            <Card key={idx} className="border-border">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {group.propertyName} — Unit {group.unitNumber}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 pr-4 font-medium">Name</th>
                        <th className="text-left py-2 pr-4 font-medium">Email</th>
                        <th className="text-left py-2 pr-4 font-medium">Phone</th>
                        <th className="text-left py-2 pr-4 font-medium">Lease Start</th>
                        <th className="text-left py-2 pr-4 font-medium">Lease End</th>
                        <th className="text-left py-2 font-medium">Split %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.tenants.map((tenant, i) => (
                        <tr key={i} className="border-b border-border/50 last:border-0">
                          <td className="py-2 pr-4 font-medium">{tenant.name}</td>
                          <td className="py-2 pr-4">{tenant.email}</td>
                          <td className="py-2 pr-4">{tenant.phone || "—"}</td>
                          <td className="py-2 pr-4">{tenant.leaseStart || "—"}</td>
                          <td className="py-2 pr-4">{tenant.leaseEnd || "—"}</td>
                          <td className="py-2">{tenant.splitPercent != null ? `${tenant.splitPercent}%` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="flex gap-2">
            <Button onClick={handleImport} disabled={importing || parsedRows.length === 0}>
              {importing ? "Importing..." : `Import ${parsedRows.length} Tenants`}
            </Button>
            <Button variant="outline" onClick={() => setStep("mapping")}>
              Back to Mapping
            </Button>
            <Button variant="outline" onClick={() => setStep("upload")}>
              Start Over
            </Button>
          </div>
        </>
      )}

      {/* Step 4: Result */}
      {step === "result" && result && (
        <Card className="border-border">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center py-8">
              <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-3 mb-4">
                <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-xl font-bold mb-2">Import Complete</h2>
              <div className="space-y-1 text-sm text-muted-foreground mb-6">
                <p>{result.tenantsCreated} new tenants created</p>
                {result.tenantsSkipped > 0 && (
                  <p>{result.tenantsSkipped} tenants skipped (already exist)</p>
                )}
              </div>
              <div className="flex gap-2">
                <Link href="/dashboard/tenants">
                  <Button>View Tenants</Button>
                </Link>
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep("upload");
                    setRawHeaders([]);
                    setRawRows([]);
                    setParsedRows([]);
                    setGrouped([]);
                    setErrors([]);
                    setResult(null);
                  }}
                >
                  Import More
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

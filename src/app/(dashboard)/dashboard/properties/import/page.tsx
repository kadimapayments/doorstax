"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import * as XLSX from "xlsx";
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
  Home,
} from "lucide-react";
import Link from "next/link";

interface ParsedRow {
  propertyName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  unitNumber: string;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  rentAmount: number;
  dueDay?: number;
  description?: string;
}

interface GroupedProperty {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  units: ParsedRow[];
}

const EXPECTED_COLUMNS = [
  "propertyName",
  "address",
  "city",
  "state",
  "zip",
  "unitNumber",
  "bedrooms",
  "bathrooms",
  "sqft",
  "rentAmount",
  "dueDay",
  "description",
];

const COLUMN_ALIASES: Record<string, string> = {
  "property name": "propertyName",
  "property": "propertyName",
  "name": "propertyName",
  "street": "address",
  "address": "address",
  "city": "city",
  "state": "state",
  "zip": "zip",
  "zip code": "zip",
  "zipcode": "zip",
  "postal": "zip",
  "unit": "unitNumber",
  "unit number": "unitNumber",
  "unit #": "unitNumber",
  "apt": "unitNumber",
  "beds": "bedrooms",
  "bedrooms": "bedrooms",
  "br": "bedrooms",
  "baths": "bathrooms",
  "bathrooms": "bathrooms",
  "ba": "bathrooms",
  "sqft": "sqft",
  "square feet": "sqft",
  "sq ft": "sqft",
  "size": "sqft",
  "rent": "rentAmount",
  "rent amount": "rentAmount",
  "monthly rent": "rentAmount",
  "price": "rentAmount",
  "due day": "dueDay",
  "due": "dueDay",
  "description": "description",
  "notes": "description",
};

function normalizeColumnName(header: string): string {
  const lower = header.trim().toLowerCase();
  return COLUMN_ALIASES[lower] || lower;
}

export default function ImportPropertiesPage() {
  const router = useRouter();
  const [step, setStep] = useState<"upload" | "mapping" | "preview" | "result">("upload");
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [grouped, setGrouped] = useState<GroupedProperty[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    propertiesCreated: number;
    unitsCreated: number;
    skippedUnits: number;
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

    for (let i = 0; i < rawRows.length; i++) {
      const raw = rawRows[i];
      const row: Record<string, string> = {};

      for (const [sourceCol, targetCol] of Object.entries(columnMapping)) {
        if (targetCol && raw[sourceCol] !== undefined) {
          row[targetCol] = String(raw[sourceCol]).trim();
        }
      }

      if (!row.propertyName) {
        errs.push(`Row ${i + 1}: Missing property name`);
        continue;
      }
      if (!row.address) {
        errs.push(`Row ${i + 1}: Missing address`);
        continue;
      }
      if (!row.unitNumber) {
        errs.push(`Row ${i + 1}: Missing unit number`);
        continue;
      }
      if (!row.rentAmount || isNaN(Number(row.rentAmount))) {
        errs.push(`Row ${i + 1}: Invalid rent amount`);
        continue;
      }

      mapped.push({
        propertyName: row.propertyName,
        address: row.address,
        city: row.city || "",
        state: row.state || "",
        zip: row.zip || "",
        unitNumber: row.unitNumber,
        bedrooms: row.bedrooms ? parseInt(row.bedrooms) : undefined,
        bathrooms: row.bathrooms ? parseFloat(row.bathrooms) : undefined,
        sqft: row.sqft ? parseInt(row.sqft) : undefined,
        rentAmount: Number(row.rentAmount),
        dueDay: row.dueDay ? parseInt(row.dueDay) : undefined,
        description: row.description || undefined,
      });
    }

    setErrors(errs);
    setParsedRows(mapped);

    // Group by property
    const groupMap = new Map<string, GroupedProperty>();
    for (const row of mapped) {
      const key = `${row.propertyName}|||${row.address}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          name: row.propertyName,
          address: row.address,
          city: row.city,
          state: row.state,
          zip: row.zip,
          units: [],
        });
      }
      groupMap.get(key)!.units.push(row);
    }
    setGrouped(Array.from(groupMap.values()));
    setStep("preview");
  }

  async function handleImport() {
    setImporting(true);
    try {
      const res = await fetch("/api/properties/import", {
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
        title="Import Properties"
        description="Upload a CSV or Excel file to bulk-create properties and units."
        actions={
          <Link href="/dashboard/properties">
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
              <p className="text-sm font-medium mb-2">Expected CSV format:</p>
              <code className="text-xs text-muted-foreground block overflow-x-auto whitespace-pre">
{`Property Name, Address, City, State, ZIP, Unit Number, Bedrooms, Bathrooms, Sqft, Rent Amount, Due Day, Description
Sunset Apartments, 123 Main St, Miami, FL, 33101, 101, 2, 1, 850, 1500, 1, Corner unit
Sunset Apartments, 123 Main St, Miami, FL, 33101, 102, 1, 1, 650, 1200, 1, Garden view`}
              </code>
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
                    <option value="propertyName">Property Name *</option>
                    <option value="address">Address *</option>
                    <option value="city">City</option>
                    <option value="state">State</option>
                    <option value="zip">ZIP</option>
                    <option value="unitNumber">Unit Number *</option>
                    <option value="bedrooms">Bedrooms</option>
                    <option value="bathrooms">Bathrooms</option>
                    <option value="sqft">Sqft</option>
                    <option value="rentAmount">Rent Amount *</option>
                    <option value="dueDay">Due Day</option>
                    <option value="description">Description</option>
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
                <p className="text-2xl font-bold">{grouped.length}</p>
                <p className="text-sm text-muted-foreground">Properties</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="pt-6 text-center">
                <Home className="h-8 w-8 mx-auto text-primary mb-2" />
                <p className="text-2xl font-bold">{parsedRows.length}</p>
                <p className="text-sm text-muted-foreground">Units</p>
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

          {grouped.map((prop, idx) => (
            <Card key={idx} className="border-border">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {prop.name}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {prop.address}
                  {prop.city && `, ${prop.city}`}
                  {prop.state && `, ${prop.state}`}
                  {prop.zip && ` ${prop.zip}`}
                </p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 pr-4 font-medium">Unit</th>
                        <th className="text-left py-2 pr-4 font-medium">Beds</th>
                        <th className="text-left py-2 pr-4 font-medium">Baths</th>
                        <th className="text-left py-2 pr-4 font-medium">Sqft</th>
                        <th className="text-left py-2 pr-4 font-medium">Rent</th>
                        <th className="text-left py-2 pr-4 font-medium">Due Day</th>
                        <th className="text-left py-2 font-medium">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prop.units.map((unit, i) => (
                        <tr key={i} className="border-b border-border/50 last:border-0">
                          <td className="py-2 pr-4 font-medium">{unit.unitNumber}</td>
                          <td className="py-2 pr-4">{unit.bedrooms ?? "—"}</td>
                          <td className="py-2 pr-4">{unit.bathrooms ?? "—"}</td>
                          <td className="py-2 pr-4">{unit.sqft ?? "—"}</td>
                          <td className="py-2 pr-4">${unit.rentAmount.toLocaleString()}</td>
                          <td className="py-2 pr-4">{unit.dueDay ?? 1}</td>
                          <td className="py-2 text-muted-foreground">{unit.description || "—"}</td>
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
              {importing ? "Importing..." : `Import ${grouped.length} Properties & ${parsedRows.length} Units`}
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
                <p>{result.propertiesCreated} new properties created</p>
                <p>{result.unitsCreated} new units created</p>
                {result.skippedUnits > 0 && (
                  <p>{result.skippedUnits} units skipped (already exist)</p>
                )}
              </div>
              <div className="flex gap-2">
                <Link href="/dashboard/properties">
                  <Button>View Properties</Button>
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

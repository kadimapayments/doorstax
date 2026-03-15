"use client";

import { useState, useCallback, useEffect } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx-js-style";
import { downloadPropertyMigrationTemplate } from "@/lib/generate-property-migration-template";
import { autoMapColumns } from "@/lib/migration-presets";
import type { PlatformPreset } from "@/lib/migration-presets";
import { PROPERTY_DOORSTAX_FIELDS, PROPERTY_MIGRATION_PRESETS } from "@/lib/property-migration-presets";
import Link from "next/link";
import {
  Upload,
  FileSpreadsheet,
  Check,
  AlertCircle,
  ArrowLeft,
  Building2,
  Home,
  Download,
  FileText,
  Loader2,
} from "lucide-react";

interface ParsedRow {
  propertyName: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  propertyType?: string;
  unitNumber: string;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  rentAmount: number;
  dueDay?: number;
  description?: string;
}

interface PresetInfo {
  id: string;
  name: string;
  description: string;
  instructions: string;
}

interface GroupedProperty {
  propertyName: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  propertyType?: string;
  units: ParsedRow[];
}

type Step = "platform" | "upload" | "mapping" | "preview" | "result";

const PROPERTY_FIELD_KEYS = PROPERTY_DOORSTAX_FIELDS.map((f) => f.key);

const PLATFORM_ICONS: Record<string, typeof Building2> = {
  buildium: Building2,
  appfolio: FileText,
  yardi: Home,
  rent_manager: FileSpreadsheet,
  generic: Upload,
};

export default function MigratePropertiesPage() {
  const [step, setStep] = useState<Step>("platform");
  const [presets, setPresets] = useState<PresetInfo[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<string>("");
  const [activePreset, setActivePreset] = useState<PlatformPreset | null>(null);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [grouped, setGrouped] = useState<GroupedProperty[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<{
    propertiesCreated: number;
    unitsCreated: number;
    skippedUnits: number;
    errors: { row: number; message: string }[];
  } | null>(null);

  // Fetch platform presets
  useEffect(() => {
    fetch("/api/properties/migrate/presets")
      .then((r) => r.json())
      .then(setPresets)
      .catch(() => {});
  }, []);

  function selectPlatform(id: string) {
    setSelectedPlatform(id);
    const preset = PROPERTY_MIGRATION_PRESETS.find((p) => p.id === id);
    if (preset) setActivePreset(preset);
    setStep("upload");
  }

  const handleFile = useCallback(
    (file: File) => {
      setFileName(file.name);
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
          const wb = XLSX.read(data, { type: "array" });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
            defval: "",
          });
          if (json.length > 0) {
            processRawData(Object.keys(json[0]), json);
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        setErrors(["Unsupported file type. Please upload a .csv, .xlsx, or .xls file."]);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activePreset]
  );

  function processRawData(headers: string[], rows: Record<string, string>[]) {
    setRawHeaders(headers);
    setRawRows(rows);

    // Auto-map columns using platform preset
    let autoMap: Record<string, string> = {};
    if (activePreset) {
      autoMap = autoMapColumns(headers, activePreset);
    } else {
      // Fallback: exact match
      for (const h of headers) {
        if ((PROPERTY_FIELD_KEYS as string[]).includes(h.toLowerCase().trim())) {
          autoMap[h] = h.toLowerCase().trim();
        }
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
      for (const [srcCol, dstField] of Object.entries(columnMapping)) {
        if (dstField && raw[srcCol] !== undefined) {
          row[dstField] = String(raw[srcCol]).trim();
        }
      }

      const rowNum = i + 1;
      if (!row.propertyName) { errs.push(`Row ${rowNum}: Missing property name`); continue; }
      if (!row.address) { errs.push(`Row ${rowNum}: Missing address`); continue; }
      if (!row.unitNumber) { errs.push(`Row ${rowNum}: Missing unit number`); continue; }
      const rentAmount = parseFloat(row.rentAmount);
      if (!rentAmount || rentAmount <= 0) { errs.push(`Row ${rowNum}: Invalid rent amount`); continue; }

      mapped.push({
        propertyName: row.propertyName,
        address: row.address,
        city: row.city || undefined,
        state: row.state || undefined,
        zip: row.zip || undefined,
        propertyType: row.propertyType || undefined,
        unitNumber: row.unitNumber,
        bedrooms: row.bedrooms ? parseInt(row.bedrooms) : undefined,
        bathrooms: row.bathrooms ? parseFloat(row.bathrooms) : undefined,
        sqft: row.sqft ? parseInt(row.sqft) : undefined,
        rentAmount,
        dueDay: row.dueDay ? parseInt(row.dueDay) : undefined,
        description: row.description || undefined,
      });
    }

    setParsedRows(mapped);
    setErrors(errs);

    // Group by property
    const propMap = new Map<string, GroupedProperty>();
    for (const row of mapped) {
      const key = row.propertyName.toLowerCase();
      if (!propMap.has(key)) {
        propMap.set(key, {
          propertyName: row.propertyName,
          address: row.address,
          city: row.city,
          state: row.state,
          zip: row.zip,
          propertyType: row.propertyType,
          units: [],
        });
      }
      propMap.get(key)!.units.push(row);
    }
    setGrouped([...propMap.values()]);
    setStep("preview");
  }

  async function runImport() {
    setImporting(true);
    try {
      const res = await fetch("/api/properties/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: parsedRows,
          platform: selectedPlatform,
          fileName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors([data.error || "Migration failed"]);
        return;
      }
      setResult(data);
      setStep("result");
    } catch {
      setErrors(["Migration request failed. Please try again."]);
    } finally {
      setImporting(false);
    }
  }

  const presetInfo = presets.find((p) => p.id === selectedPlatform);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/properties"
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Migrate Properties
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Import properties and units from another platform
          </p>
        </div>
      </div>

      {/* Step Indicators */}
      <div className="flex items-center gap-2 text-xs font-medium">
        {(["platform", "upload", "mapping", "preview", "result"] as Step[]).map(
          (s, i) => {
            const labels = ["Platform", "Upload", "Mapping", "Preview", "Result"];
            const isActive = step === s;
            const isPast =
              ["platform", "upload", "mapping", "preview", "result"].indexOf(step) > i;
            return (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && (
                  <div
                    className={`h-px w-6 ${isPast ? "bg-primary" : "bg-border"}`}
                  />
                )}
                <span
                  className={`px-3 py-1 rounded-full ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isPast
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {labels[i]}
                </span>
              </div>
            );
          }
        )}
      </div>

      {/* ── Step 1: Platform Selection ── */}
      {step === "platform" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Select the platform you&apos;re migrating from. This will auto-map
            the column names to DoorStax fields.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {presets.map((preset) => {
              const Icon = PLATFORM_ICONS[preset.id] || FileSpreadsheet;
              return (
                <button
                  key={preset.id}
                  onClick={() => selectPlatform(preset.id)}
                  className="rounded-xl border bg-card p-6 text-left hover:border-primary hover:shadow-md transition-all"
                >
                  <Icon className="h-8 w-8 text-primary mb-3" />
                  <h3 className="font-semibold text-foreground">
                    {preset.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {preset.description}
                  </p>
                </button>
              );
            })}
          </div>
          <div className="rounded-xl border bg-muted/30 p-4">
            <button
              onClick={() => downloadPropertyMigrationTemplate()}
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <Download className="h-4 w-4" />
              Download blank property migration template
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Upload ── */}
      {step === "upload" && (
        <div className="space-y-4">
          {presetInfo && (
            <div className="rounded-xl border bg-blue-50 dark:bg-blue-950/30 p-4 text-sm">
              <p className="font-medium text-blue-700 dark:text-blue-400">
                {presetInfo.name} Import Instructions:
              </p>
              <p className="text-blue-600 dark:text-blue-300 mt-1">
                {presetInfo.instructions}
              </p>
            </div>
          )}
          <div
            className="rounded-xl border-2 border-dashed bg-card p-12 text-center cursor-pointer hover:border-primary transition-colors"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) handleFile(file);
            }}
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".csv,.xlsx,.xls";
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) handleFile(file);
              };
              input.click();
            }}
          >
            <Upload className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Drop your file here or click to browse
            </h3>
            <p className="text-sm text-muted-foreground">
              Supports .csv, .xlsx, .xls files (max 500 rows)
            </p>
          </div>
          <button
            onClick={() => setStep("platform")}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            &larr; Back to platform selection
          </button>
        </div>
      )}

      {/* ── Step 3: Column Mapping ── */}
      {step === "mapping" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Map your file columns to DoorStax fields. Auto-mapped columns are
            shown in green.
          </p>
          <div className="rounded-xl border bg-card divide-y">
            {rawHeaders.map((header) => (
              <div
                key={header}
                className="flex items-center justify-between px-4 py-3"
              >
                <span className="text-sm font-medium truncate max-w-[200px]">
                  {header}
                </span>
                <select
                  value={columnMapping[header] || ""}
                  onChange={(e) =>
                    setColumnMapping((prev) => ({
                      ...prev,
                      [header]: e.target.value,
                    }))
                  }
                  className={`w-48 rounded-lg border px-3 py-1.5 text-sm ${
                    columnMapping[header]
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                      : "border-border bg-background"
                  }`}
                >
                  <option value="">&mdash; Skip &mdash;</option>
                  {PROPERTY_DOORSTAX_FIELDS.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label} {f.required ? "*" : ""}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setStep("upload")}
              className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted"
            >
              &larr; Back
            </button>
            <button
              onClick={applyMapping}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
            >
              Apply Mapping & Preview
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Preview ── */}
      {step === "preview" && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border bg-card p-4 text-center">
              <Building2 className="mx-auto h-6 w-6 text-primary mb-1" />
              <p className="text-xl font-bold">{grouped.length}</p>
              <p className="text-xs text-muted-foreground">Properties</p>
            </div>
            <div className="rounded-xl border bg-card p-4 text-center">
              <Home className="mx-auto h-6 w-6 text-primary mb-1" />
              <p className="text-xl font-bold">
                {grouped.reduce((s, p) => s + p.units.length, 0)}
              </p>
              <p className="text-xs text-muted-foreground">Units</p>
            </div>
            <div className="rounded-xl border bg-card p-4 text-center">
              <FileText className="mx-auto h-6 w-6 text-primary mb-1" />
              <p className="text-xl font-bold">{parsedRows.length}</p>
              <p className="text-xs text-muted-foreground">Total Rows</p>
            </div>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium text-red-600">
                  {errors.length} row(s) with issues (will be skipped)
                </span>
              </div>
              <ul className="text-xs text-red-500 space-y-1 max-h-32 overflow-auto">
                {errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Grouped preview */}
          <div className="space-y-3">
            {grouped.map((prop) => (
              <div
                key={prop.propertyName}
                className="rounded-xl border bg-card overflow-hidden"
              >
                <div className="px-4 py-3 bg-muted/50 border-b">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">
                      {prop.propertyName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      &mdash; {prop.address}
                      {prop.city && `, ${prop.city}`}
                      {prop.state && `, ${prop.state}`}
                      {prop.zip && ` ${prop.zip}`}
                    </span>
                    {prop.propertyType && (
                      <span className="ml-1 px-2 py-0.5 text-[10px] rounded-full bg-primary/10 text-primary font-medium">
                        {prop.propertyType}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {prop.units.length} unit(s)
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="px-4 py-2 text-left font-medium">Unit</th>
                        <th className="px-4 py-2 text-left font-medium">Beds</th>
                        <th className="px-4 py-2 text-left font-medium">Baths</th>
                        <th className="px-4 py-2 text-left font-medium">Sq Ft</th>
                        <th className="px-4 py-2 text-right font-medium">Rent</th>
                        <th className="px-4 py-2 text-left font-medium">Due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {prop.units.map((unit, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2 font-medium">{unit.unitNumber}</td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {unit.bedrooms ?? "—"}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {unit.bathrooms ?? "—"}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {unit.sqft ? unit.sqft.toLocaleString() : "—"}
                          </td>
                          <td className="px-4 py-2 text-right">
                            ${unit.rentAmount.toLocaleString()}/mo
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {unit.dueDay ? `${unit.dueDay}${ordinal(unit.dueDay)}` : "1st"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep("mapping")}
              className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted"
            >
              &larr; Back
            </button>
            <button
              onClick={runImport}
              disabled={importing || parsedRows.length === 0}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {importing ? (
                <>
                  <Loader2 className="inline mr-2 h-4 w-4 animate-spin" />
                  Migrating...
                </>
              ) : (
                `Import ${grouped.length} Property(ies) & ${grouped.reduce((s, p) => s + p.units.length, 0)} Unit(s)`
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 5: Result ── */}
      {step === "result" && result && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-emerald-50 dark:bg-emerald-950/30 p-6 text-center">
            <Check className="mx-auto h-12 w-12 text-emerald-500 mb-3" />
            <h3 className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
              Migration Complete!
            </h3>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Properties Created", value: result.propertiesCreated },
              { label: "Units Created", value: result.unitsCreated },
              { label: "Units Skipped", value: result.skippedUnits },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border bg-card p-4 text-center"
              >
                <p className="text-2xl font-bold">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>

          {result.errors.length > 0 && (
            <div className="rounded-xl border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 p-4">
              <p className="text-sm font-medium text-yellow-700 mb-2">
                {result.errors.length} note(s):
              </p>
              <ul className="text-xs text-yellow-600 space-y-1 max-h-32 overflow-auto">
                {result.errors.map((err, i) => (
                  <li key={i}>
                    Row {err.row}: {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            <Link
              href="/dashboard/properties"
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
            >
              View Properties
            </Link>
            <button
              onClick={() => {
                setStep("platform");
                setResult(null);
                setParsedRows([]);
                setGrouped([]);
                setErrors([]);
              }}
              className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted"
            >
              Import More
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

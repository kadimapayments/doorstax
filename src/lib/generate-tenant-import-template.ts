import * as XLSX from "xlsx-js-style";

// ── Brand colours ──────────────────────────────────────────────
const PURPLE = "7C3AED";
const LAVENDER = "F3EFFF";
const WHITE = "FFFFFF";
const MUTED = "9DA2B3";
const DARK = "1E1B2E";

// ── Reusable style fragments ──────────────────────────────────
const titleStyle: XLSX.CellStyle = {
  fill: { fgColor: { rgb: PURPLE } },
  font: { bold: true, color: { rgb: WHITE }, sz: 16, name: "Arial" },
  alignment: { horizontal: "left", vertical: "center" },
};

const instructionStyle: XLSX.CellStyle = {
  fill: { fgColor: { rgb: LAVENDER } },
  font: { italic: true, color: { rgb: DARK }, sz: 10, name: "Arial" },
  alignment: { horizontal: "left", vertical: "center", wrapText: true },
};

const headerStyle: XLSX.CellStyle = {
  fill: { fgColor: { rgb: PURPLE } },
  font: { bold: true, color: { rgb: WHITE }, sz: 11, name: "Arial" },
  alignment: { horizontal: "center", vertical: "center" },
  border: {
    bottom: { style: "thin", color: { rgb: WHITE } },
  },
};

const exampleEven: XLSX.CellStyle = {
  fill: { fgColor: { rgb: LAVENDER } },
  font: { color: { rgb: MUTED }, sz: 10, name: "Arial" },
  alignment: { vertical: "center" },
};

const exampleOdd: XLSX.CellStyle = {
  fill: { fgColor: { rgb: WHITE } },
  font: { color: { rgb: MUTED }, sz: 10, name: "Arial" },
  alignment: { vertical: "center" },
};

// ── Cell helper ───────────────────────────────────────────────
function cell(
  value: string | number,
  style: XLSX.CellStyle,
  type: "s" | "n" = "s"
) {
  return { v: value, t: type, s: style };
}

// ── Column definitions ────────────────────────────────────────
const COLUMNS = [
  { header: "Name *", width: 20 },
  { header: "Email *", width: 24 },
  { header: "Phone", width: 14 },
  { header: "Property Name *", width: 22 },
  { header: "Unit Number *", width: 14 },
  { header: "Lease Start", width: 14 },
  { header: "Lease End", width: 14 },
  { header: "Rent Split %", width: 14 },
];

const EXAMPLE_ROWS = [
  ["John Smith", "john@example.com", "555-0101", "Sunset Apartments", "101", "2025-01-01", "2026-01-01", 100],
  ["Jane Doe", "jane@example.com", "555-0102", "Sunset Apartments", "102", "2025-02-01", "2026-02-01", 100],
  ["Bob Wilson", "bob@example.com", "", "Ocean View Plaza", "A1", "2025-03-01", "2026-03-01", 50],
];

// ── Main export ───────────────────────────────────────────────
export function downloadTenantImportTemplate(): void {
  const colCount = COLUMNS.length;

  /* ---------- Row 0 — Title (merged) ---------- */
  const titleRow = Array.from({ length: colCount }, () => cell("", titleStyle));
  titleRow[0] = cell("DoorStax \u2014 Tenant Import Template", titleStyle);

  /* ---------- Row 1 — Instructions (merged) ---------- */
  const instrRow = Array.from({ length: colCount }, () =>
    cell("", instructionStyle)
  );
  instrRow[0] = cell(
    "Fill in your tenant data below. * = required. Property Name and Unit Number must match existing properties in your account.",
    instructionStyle
  );

  /* ---------- Row 2 — Spacer ---------- */
  const spacerRow = Array.from({ length: colCount }, () => cell("", {}));

  /* ---------- Row 3 — Headers ---------- */
  const headerRow = COLUMNS.map((col) => cell(col.header, headerStyle));

  /* ---------- Rows 4-6 — Example data ---------- */
  const exampleStyled = EXAMPLE_ROWS.map((row, rowIdx) => {
    const style = rowIdx % 2 === 0 ? exampleEven : exampleOdd;
    return row.map((val) =>
      cell(val, style, typeof val === "number" ? "n" : "s")
    );
  });

  /* ---------- Build sheet from array-of-arrays ---------- */
  const aoa = [titleRow, instrRow, spacerRow, headerRow, ...exampleStyled];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  /* ---------- Merges ---------- */
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } }, // title row
    { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } }, // instructions row
  ];

  /* ---------- Column widths ---------- */
  ws["!cols"] = COLUMNS.map((col) => ({ wch: col.width }));

  /* ---------- Row heights ---------- */
  ws["!rows"] = [
    { hpt: 36 }, // title
    { hpt: 32 }, // instructions
    { hpt: 8 },  // spacer
    { hpt: 28 }, // headers
  ];

  /* ---------- Write & download ---------- */
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tenant Import Template");
  XLSX.writeFile(wb, "DoorStax-Tenant-Import-Template.xlsx");
}

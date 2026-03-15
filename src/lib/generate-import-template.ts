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
  { header: "Property Name *", width: 22 },
  { header: "Address *", width: 22 },
  { header: "City *", width: 18 },
  { header: "State *", width: 8 },
  { header: "ZIP *", width: 10 },
  { header: "Unit Number *", width: 14 },
  { header: "Bedrooms", width: 11 },
  { header: "Bathrooms", width: 11 },
  { header: "Sqft", width: 8 },
  { header: "Rent Amount *", width: 14 },
  { header: "Due Day", width: 10 },
  { header: "Description", width: 30 },
];

const EXAMPLE_ROWS = [
  ["Sunset Apartments", "123 Main St", "Miami", "FL", "33101", "101", 2, 1, 850, 1500, 1, "Corner unit with balcony"],
  ["Sunset Apartments", "123 Main St", "Miami", "FL", "33101", "102", 1, 1, 650, 1200, 1, "Garden view"],
  ["Ocean View Plaza", "456 Beach Rd", "Fort Lauderdale", "FL", "33301", "A1", 3, 2, 1200, 2500, 1, "Top floor penthouse"],
];

// ── Main export ───────────────────────────────────────────────
export function downloadPropertyImportTemplate(): void {
  const colCount = COLUMNS.length;

  /* ---------- Row 0 — Title (merged) ---------- */
  const titleRow = Array.from({ length: colCount }, () => cell("", titleStyle));
  titleRow[0] = cell("DoorStax \u2014 Property Import Template", titleStyle);

  /* ---------- Row 1 — Instructions (merged) ---------- */
  const instrRow = Array.from({ length: colCount }, () =>
    cell("", instructionStyle)
  );
  instrRow[0] = cell(
    "Fill in your property and unit data below. Columns marked with * are required. Each row represents one unit. Properties with the same name & address are grouped automatically.",
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
  XLSX.utils.book_append_sheet(wb, ws, "Property Import Template");
  XLSX.writeFile(wb, "DoorStax-Property-Import-Template.xlsx");
}

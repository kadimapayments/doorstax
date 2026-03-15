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

function cell(
  value: string | number,
  style: XLSX.CellStyle,
  type: "s" | "n" = "s"
) {
  return { v: value, t: type, s: style };
}

// ── Column definitions (extended for full migration) ──────────
const COLUMNS = [
  { header: "Name *", width: 20 },
  { header: "Email *", width: 24 },
  { header: "Phone", width: 14 },
  { header: "Property Name *", width: 22 },
  { header: "Address", width: 28 },
  { header: "City", width: 16 },
  { header: "State", width: 8 },
  { header: "ZIP", width: 10 },
  { header: "Unit Number *", width: 14 },
  { header: "Bedrooms", width: 10 },
  { header: "Bathrooms", width: 10 },
  { header: "Sq Ft", width: 10 },
  { header: "Rent Amount *", width: 14 },
  { header: "Lease Start", width: 14 },
  { header: "Lease End", width: 14 },
];

const EXAMPLE_ROWS = [
  ["John Smith", "john@example.com", "555-0101", "Sunset Apartments", "123 Main St", "Miami", "FL", "33101", "101", 2, 1, 850, 1500, "2025-01-01", "2026-01-01"],
  ["Jane Doe", "jane@example.com", "555-0102", "Sunset Apartments", "123 Main St", "Miami", "FL", "33101", "102", 1, 1, 650, 1200, "2025-02-01", "2026-02-01"],
  ["Bob Wilson", "bob@example.com", "", "Ocean View Plaza", "456 Beach Ave", "Fort Lauderdale", "FL", "33301", "A1", 3, 2, 1200, 2100, "2025-03-01", "2026-03-01"],
];

export function downloadMigrationTemplate(): void {
  const colCount = COLUMNS.length;

  const titleRow = Array.from({ length: colCount }, () => cell("", titleStyle));
  titleRow[0] = cell("DoorStax \u2014 Migration Import Template", titleStyle);

  const instrRow = Array.from({ length: colCount }, () =>
    cell("", instructionStyle)
  );
  instrRow[0] = cell(
    "Fill in your tenant data below. * = required. Properties and units that don't exist will be created automatically. Dates use YYYY-MM-DD format.",
    instructionStyle
  );

  const spacerRow = Array.from({ length: colCount }, () => cell("", {}));
  const headerRow = COLUMNS.map((col) => cell(col.header, headerStyle));

  const exampleStyled = EXAMPLE_ROWS.map((row, rowIdx) => {
    const style = rowIdx % 2 === 0 ? exampleEven : exampleOdd;
    return row.map((val) =>
      cell(val, style, typeof val === "number" ? "n" : "s")
    );
  });

  const aoa = [titleRow, instrRow, spacerRow, headerRow, ...exampleStyled];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
  ];

  ws["!cols"] = COLUMNS.map((col) => ({ wch: col.width }));

  ws["!rows"] = [
    { hpt: 36 },
    { hpt: 32 },
    { hpt: 8 },
    { hpt: 28 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Migration Template");
  XLSX.writeFile(wb, "DoorStax-Migration-Template.xlsx");
}

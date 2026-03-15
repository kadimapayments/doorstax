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

// ── Column definitions ──────────────────────────────────────────
const COLUMNS = [
  { header: "Property Name *", width: 22 },
  { header: "Address *", width: 28 },
  { header: "City", width: 16 },
  { header: "State", width: 8 },
  { header: "ZIP", width: 10 },
  { header: "Property Type", width: 16 },
  { header: "Unit Number *", width: 14 },
  { header: "Bedrooms", width: 10 },
  { header: "Bathrooms", width: 10 },
  { header: "Sq Ft", width: 10 },
  { header: "Rent Amount *", width: 14 },
  { header: "Due Day", width: 10 },
  { header: "Description", width: 30 },
];

const EXAMPLE_ROWS = [
  ["Sunset Apartments", "123 Main St", "Miami", "FL", "33101", "MULTIFAMILY", "101", 2, 1, 850, 1500, 1, "Corner unit"],
  ["Sunset Apartments", "123 Main St", "Miami", "FL", "33101", "MULTIFAMILY", "102", 1, 1, 650, 1200, 1, "Garden view"],
  ["123 Oak Lane", "123 Oak Ln", "Tampa", "FL", "33602", "SINGLE_FAMILY", "MAIN", 3, 2, 1800, 2200, 1, "Single family home"],
];

export function downloadPropertyMigrationTemplate(): void {
  const colCount = COLUMNS.length;

  const titleRow = Array.from({ length: colCount }, () => cell("", titleStyle));
  titleRow[0] = cell("DoorStax \u2014 Property Migration Template", titleStyle);

  const instrRow = Array.from({ length: colCount }, () =>
    cell("", instructionStyle)
  );
  instrRow[0] = cell(
    "Fill in your property and unit data below. * = required. Each row represents one unit. Properties with multiple units should repeat the property info. Property Type: SINGLE_FAMILY, MULTIFAMILY, OFFICE, or COMMERCIAL.",
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
  XLSX.utils.book_append_sheet(wb, ws, "Property Migration Template");
  XLSX.writeFile(wb, "DoorStax-Property-Migration-Template.xlsx");
}

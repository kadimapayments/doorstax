/**
 * Tiny CSV helper shared by the /api/reports/* routes.
 *
 * Escapes commas, quotes, and newlines per RFC 4180. No streaming —
 * these reports are expected to be small enough to buffer (max a
 * few thousand rows for a mid-size PM).
 */
export function toCsv(
  rows: Array<Record<string, unknown>>,
  headerOrder?: string[]
): string {
  if (rows.length === 0) return "";
  const headers = headerOrder ?? Object.keys(rows[0]);
  const escape = (v: unknown): string => {
    if (v == null) return "";
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}

export function csvResponse(csv: string, filename: string) {
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

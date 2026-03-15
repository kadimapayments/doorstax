import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  addBrandingHeader,
  addAccentLine,
  addFooter,
  formatMoney,
  hexToRgb,
  checkPageBreak,
  drawFinancialSummaryBlock,
} from "@/lib/pdf-utils";
import { db } from "@/lib/db";

/**
 * Generate a consolidated PM Payout Summary Report PDF for a given month/year.
 * Includes all owner payouts with totals, status breakdown, and fee detail.
 */
export async function generatePayoutReportPdf(
  landlordId: string,
  month: number,
  year: number
): Promise<Buffer> {
  // Period boundaries (1-indexed month)
  const periodStart = new Date(year, month - 1, 1);

  // Fetch all payouts for this period
  const payouts = await db.ownerPayout.findMany({
    where: {
      landlordId,
      periodStart: { gte: periodStart },
      periodEnd: { lte: new Date(year, month, 1) },
    },
    include: {
      owner: {
        select: {
          name: true,
          properties: { select: { name: true } },
        },
      },
    },
    orderBy: { owner: { name: "asc" } },
  });

  // Branding
  const [landlordUser, docSettings] = await Promise.all([
    db.user.findUnique({
      where: { id: landlordId },
      select: { companyLogo: true, companyName: true },
    }),
    db.documentSettings.findUnique({ where: { landlordId } }).catch(() => null),
  ]);

  const primaryColor = docSettings?.primaryColor || "#5B00FF";
  const [pr, pg, pb] = hexToRgb(primaryColor);
  const monthName = periodStart.toLocaleString("en-US", { month: "long" });

  // Prepare row data
  const rows = payouts.map((p) => {
    const totalFees =
      Number(p.processingFees) +
      Number(p.managementFee) +
      Number(p.expenses) +
      Number(p.platformFee) +
      Number(p.payoutFee) +
      Number(p.unitFee);
    return {
      ownerName: p.owner.name,
      properties:
        p.owner.properties
          ?.map((prop: { name: string }) => prop.name)
          .join(", ") || "—",
      grossRent: Number(p.grossRent),
      totalFees,
      netPayout: Number(p.netPayout),
      status: p.status,
    };
  });

  const totalGross = rows.reduce((s, r) => s + r.grossRent, 0);
  const totalFees = rows.reduce((s, r) => s + r.totalFees, 0);
  const totalNet = rows.reduce((s, r) => s + r.netPayout, 0);

  // Status counts
  const statusCounts: Record<string, number> = {};
  for (const r of rows) {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  }

  // ── Generate PDF ──────────────────────────────────────
  const doc = new jsPDF();

  let y = await addBrandingHeader(doc, "Payout Summary Report", {
    companyLogo: landlordUser?.companyLogo,
    companyName: landlordUser?.companyName,
    primaryColor,
  });

  y = addAccentLine(doc, y, primaryColor);

  // Period info block
  doc.setFontSize(10);
  const infoRows: [string, string][] = [
    ["Reporting Period", `${monthName} ${year}`],
    ["Total Owners", String(rows.length)],
    ["Generated", new Date().toLocaleDateString()],
  ];

  for (const [label, value] of infoRows) {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, 60, y);
    y += 6;
  }
  y += 4;

  // Financial summary block (Stripe-style)
  y = drawFinancialSummaryBlock(
    doc,
    y,
    [
      { label: "Total Gross Rent", value: formatMoney(totalGross) },
      {
        label: "Total Fees & Expenses",
        value: `-${formatMoney(totalFees)}`,
        prefix: "-",
      },
      { label: "Total Net Payouts", value: formatMoney(totalNet) },
    ],
    primaryColor
  );

  // Status breakdown
  y = checkPageBreak(doc, y, 20);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text("Status Breakdown", 14, y);
  doc.setFont("helvetica", "normal");
  y += 6;

  const statusColorMap: Record<string, [number, number, number]> = {
    DRAFT: [107, 114, 128],
    APPROVED: [59, 130, 246],
    PROCESSING: [234, 179, 8],
    PAID: [16, 185, 129],
    FAILED: [239, 68, 68],
  };

  const statusLabels = Object.entries(statusCounts);
  if (statusLabels.length > 0) {
    let xOffset = 14;
    for (const [status, count] of statusLabels) {
      const color = statusColorMap[status] || [107, 114, 128];
      doc.setFillColor(...color);
      doc.roundedRect(xOffset, y - 3, 4, 4, 1, 1, "F");
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(`${status}: ${count}`, xOffset + 6, y);
      xOffset += 40;
    }
    y += 10;
  }

  // Owner payout detail table
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text("Owner Payout Details", 14, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [["Owner", "Properties", "Gross Rent", "Fees", "Net Payout", "Status"]],
    body: rows.map((r) => [
      r.ownerName,
      r.properties,
      formatMoney(r.grossRent),
      `-${formatMoney(r.totalFees)}`,
      formatMoney(r.netPayout),
      r.status,
    ]),
    foot: [
      [
        `Total (${rows.length} owners)`,
        "",
        formatMoney(totalGross),
        `-${formatMoney(totalFees)}`,
        formatMoney(totalNet),
        "",
      ],
    ],
    headStyles: {
      fillColor: [pr, pg, pb],
      textColor: 255,
      fontStyle: "bold",
    },
    footStyles: {
      fillColor: [248, 250, 252],
      textColor: [40, 40, 40],
      fontStyle: "bold",
    },
    styles: { fontSize: 9 },
    columnStyles: {
      2: { halign: "right" as const },
      3: { halign: "right" as const },
      4: { halign: "right" as const },
    },
    margin: { left: 14, right: 14 },
  });

  // Footer
  addFooter(doc, { footerText: docSettings?.footerText || undefined });

  return Buffer.from(doc.output("arraybuffer"));
}

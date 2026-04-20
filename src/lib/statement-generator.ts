import { db } from "@/lib/db";
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
  drawPropertySectionHeader,
  drawDistributionConfirmation,
} from "@/lib/pdf-utils";

/**
 * Generate an Owner Payout Statement PDF for a given owner/month/year.
 * Returns { buffer, netPayout } — the PDF as a Buffer plus the net amount for email display.
 */
export async function generateOwnerStatementPdf(
  ownerId: string,
  landlordId: string,
  month: number,
  year: number
): Promise<{ buffer: Buffer; netPayout: number; ownerName: string }> {
  // Fetch owner
  const owner = await db.owner.findFirst({
    where: { id: ownerId, landlordId },
    include: {
      properties: { select: { id: true, name: true } },
    },
  });

  if (!owner) throw new Error("Owner not found");

  // Period boundaries (1-indexed month)
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0, 23, 59, 59);

  // Find payout for this period
  const payout = await db.ownerPayout.findFirst({
    where: {
      ownerId,
      landlordId,
      periodStart: { gte: periodStart },
      periodEnd: { lte: new Date(year, month, 1) },
    },
  });

  // Fetch payments in this period for the owner's properties
  const propertyIds = owner.properties.map((p) => p.id);
  const payments = propertyIds.length
    ? await db.payment.findMany({
        where: {
          landlordId,
          unit: { propertyId: { in: propertyIds } },
          status: "COMPLETED",
          dueDate: { gte: periodStart, lte: periodEnd },
        },
        include: {
          tenant: { include: { user: { select: { name: true } } } },
          unit: {
            select: {
              unitNumber: true,
              property: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { dueDate: "asc" },
      })
    : [];

  // Branding
  const [landlordUser, docSettings] = await Promise.all([
    db.user.findUnique({
      where: { id: landlordId },
      select: { companyLogo: true, companyName: true },
    }),
    db.documentSettings
      .findUnique({ where: { landlordId } })
      .catch(() => null),
  ]);

  const primaryColor = docSettings?.primaryColor || "#5B00FF";
  const [pr, pg, pb] = hexToRgb(primaryColor);

  // Fee calculations
  const grossRent = payout
    ? Number(payout.grossRent)
    : payments.reduce((s, p) => s + Number(p.amount), 0);
  const processingFees = payout ? Number(payout.processingFees) : 0;
  const managementFee = payout ? Number(payout.managementFee) : 0;
  const payoutFee = payout ? Number(payout.payoutFee) : 0;
  const unitFee = payout ? Number(payout.unitFee) : 0;
  const expenses = payout ? Number(payout.expenses) : 0;
  const platformFee = payout ? Number(payout.platformFee) : 0;
  const totalFees =
    processingFees + managementFee + payoutFee + unitFee + expenses + platformFee;
  const netPayout = payout
    ? Number(payout.netPayout)
    : grossRent - totalFees;

  // Group payments by property
  const paymentsByProperty = new Map<
    string,
    { name: string; payments: typeof payments; total: number }
  >();

  for (const p of payments) {
    const propId = p.unit.property.id;
    const existing = paymentsByProperty.get(propId);
    if (existing) {
      existing.payments.push(p);
      existing.total += Number(p.amount);
    } else {
      paymentsByProperty.set(propId, {
        name: p.unit.property.name,
        payments: [p],
        total: Number(p.amount),
      });
    }
  }

  // ── Generate PDF ──
  const doc = new jsPDF();
  const monthName = periodStart.toLocaleString("en-US", { month: "long" });

  let y = await addBrandingHeader(doc, "Owner Payout Statement", {
    companyLogo: landlordUser?.companyLogo,
    companyName: landlordUser?.companyName,
    primaryColor,
  });

  y = addAccentLine(doc, y, primaryColor);

  // Info section
  doc.setFontSize(10);
  const infoRows: [string, string][] = [
    ["Owner", owner.name],
    [
      "Portfolio",
      owner.properties.map((p) => p.name).join(", ") || "No properties",
    ],
    ["Reporting Period", `${monthName} ${year}`],
    ["Statement Date", new Date().toLocaleDateString()],
  ];

  for (const [label, value] of infoRows) {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, 60, y);
    y += 6;
  }
  y += 4;

  // Section A: Funds Movement Summary
  y = checkPageBreak(doc, y, 50);
  y = drawFinancialSummaryBlock(
    doc,
    y,
    [
      { label: "Total Rent Collected", value: formatMoney(grossRent) },
      {
        label: "Total Fees & Expenses",
        value: `-${formatMoney(totalFees)}`,
        prefix: "-",
      },
      { label: "Net Owner Distribution", value: formatMoney(netPayout) },
    ],
    primaryColor
  );

  // Section B: Fee Breakdown — appears BEFORE the transaction ledger so
  // the owner sees how the net payout was derived before scanning the
  // per-property transaction detail.
  y = checkPageBreak(doc, y, 40);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text("Fee Breakdown", 14, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  y += 4;

  const feeRows: [string, string][] = [
    ["Gross Rent Collected", formatMoney(grossRent)],
  ];

  if (processingFees > 0)
    feeRows.push(["Payment Processing Expense", `-${formatMoney(processingFees)}`]);
  if (managementFee > 0)
    feeRows.push([
      `Management Fee (${Number(owner.managementFeePercent)}%)`,
      `-${formatMoney(managementFee)}`,
    ]);
  if (payoutFee > 0)
    feeRows.push(["Transaction Processing Fee", `-${formatMoney(payoutFee)}`]);
  if (unitFee > 0) feeRows.push(["Unit Fees", `-${formatMoney(unitFee)}`]);
  if (platformFee > 0)
    feeRows.push(["Platform Fee", `-${formatMoney(platformFee)}`]);
  if (expenses > 0) feeRows.push(["Expenses", `-${formatMoney(expenses)}`]);

  autoTable(doc, {
    startY: y,
    body: [
      ...feeRows,
      [
        {
          content: "Net Payout",
          styles: {
            fontStyle: "bold" as const,
            textColor: [pr, pg, pb],
          },
        },
        {
          content: formatMoney(netPayout),
          styles: {
            fontStyle: "bold" as const,
            textColor: [pr, pg, pb],
          },
        },
      ],
    ],
    theme: "plain",
    styles: { fontSize: 10 },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { halign: "right" as const },
    },
    margin: { left: 14, right: 14 },
  });

  y =
    (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 8;

  // Section C: Transaction Ledger (Property-Grouped)
  if (payments.length > 0) {
    y = checkPageBreak(doc, y, 20);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40, 40, 40);
    doc.text("Transaction Ledger", 14, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    y += 6;

    for (const [, group] of paymentsByProperty) {
      y = checkPageBreak(doc, y, 30);

      y = drawPropertySectionHeader(
        doc,
        y,
        group.name,
        formatMoney(group.total),
        primaryColor
      );

      autoTable(doc, {
        startY: y,
        head: [["Date", "Tenant", "Unit", "Amount", "Method"]],
        body: group.payments.map((p) => [
          p.dueDate.toLocaleDateString(),
          p.tenant.user.name,
          p.unit.unitNumber,
          formatMoney(Number(p.amount)),
          p.paymentMethod?.toUpperCase() || "—",
        ]),
        headStyles: {
          fillColor: [pr, pg, pb],
          textColor: 255,
          fontStyle: "bold",
        },
        styles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
      });

      y =
        (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
          .finalY + 6;
    }
    y += 4;
  } else {
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text("No completed payments in this period.", 14, y);
    doc.setTextColor(0, 0, 0);
    y += 10;
  }

  // Section D: Distribution Confirmation
  if (payout) {
    y = checkPageBreak(doc, y, 40);
    y = drawDistributionConfirmation(
      doc,
      y,
      {
        method: payout.paymentMethod?.toUpperCase() || "Pending",
        date: payout.paidAt ? payout.paidAt.toLocaleDateString() : null,
        status: payout.status as
          | "PAID"
          | "PROCESSING"
          | "APPROVED"
          | "DRAFT"
          | "FAILED",
      },
      primaryColor
    );
  }

  // Footer
  addFooter(doc, { footerText: docSettings?.footerText || undefined });

  const buffer = Buffer.from(doc.output("arraybuffer"));

  return { buffer, netPayout, ownerName: owner.name };
}

/**
 * Generates a branded DoorStax billing invoice PDF using jsPDF.
 * Uses the shared pdf-utils branding for consistent fintech look.
 */
import jsPDF from "jspdf";
import {
  addBrandingHeader,
  addAccentLine,
  addFooter,
  formatMoney,
} from "./pdf-utils";

export interface InvoiceLineItem {
  range: string;
  count: number;
  rate: number;
  total: number;
}

export interface InvoicePdfData {
  invoiceNumber: string;
  period: string;
  pmName: string;
  pmEmail: string;
  pmCompany?: string;
  unitCount: number;
  tierName: string;
  baseCharge: number;
  additionalUnits: InvoiceLineItem[];
  amount: number;
  creditAmount: number;
  creditReason?: string;
  adjustmentAmount: number;
  adjustmentReason?: string;
  netAmount: number;
  status: string;
  paidAt?: Date | string | null;
  paymentMethod?: string;
  dueDate: Date | string;
  createdAt: Date | string;
}

export async function generateBillingInvoicePdf(
  data: InvoicePdfData
): Promise<Buffer> {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const PAGE_W = doc.internal.pageSize.getWidth();
  const MARGIN = 14;
  let y = await addBrandingHeader(doc, "INVOICE", {
    primaryColor: "#5B00FF",
  });
  y = addAccentLine(doc, y, "#5B00FF");
  y += 4;

  // Invoice details
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text(`Invoice #: ${data.invoiceNumber}`, PAGE_W - MARGIN, y, {
    align: "right",
  });
  y += 14;
  doc.text(
    `Date: ${new Date(data.createdAt).toLocaleDateString("en-US")}`,
    PAGE_W - MARGIN,
    y,
    { align: "right" }
  );
  y += 14;
  doc.text(`Period: ${data.period}`, PAGE_W - MARGIN, y, {
    align: "right",
  });
  y += 14;
  doc.text(
    `Due: ${new Date(data.dueDate).toLocaleDateString("en-US")}`,
    PAGE_W - MARGIN,
    y,
    { align: "right" }
  );
  y += 30;

  // ── Bill To ─────────────────────────────────────
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("Bill To:", MARGIN, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.text(data.pmName, MARGIN, y);
  y += 12;
  if (data.pmCompany) {
    doc.setTextColor(100, 100, 100);
    doc.text(data.pmCompany, MARGIN, y);
    y += 12;
  }
  doc.setTextColor(100, 100, 100);
  doc.text(data.pmEmail, MARGIN, y);
  y += 12;
  doc.text(`Tier: ${data.tierName} · ${data.unitCount} units`, MARGIN, y);
  y += 25;

  // ── Line Items Table ────────────────────────────
  const colX = [MARGIN, MARGIN + 260, MARGIN + 340, PAGE_W - MARGIN];

  // Header row
  doc.setFillColor(245, 245, 250);
  doc.rect(MARGIN, y - 2, PAGE_W - MARGIN * 2, 18, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(80, 80, 80);
  doc.text("Description", colX[0] + 6, y + 10);
  doc.text("Qty", colX[1], y + 10, { align: "right" });
  doc.text("Rate", colX[2], y + 10, { align: "right" });
  doc.text("Amount", colX[3], y + 10, { align: "right" });
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(9);

  // Base charge
  doc.text("Platform base fee (first 50 units)", colX[0] + 6, y + 10);
  doc.text("1", colX[1], y + 10, { align: "right" });
  doc.text("$150.00", colX[2], y + 10, { align: "right" });
  doc.text(`$${data.baseCharge.toFixed(2)}`, colX[3], y + 10, {
    align: "right",
  });
  y += 18;

  // Additional unit brackets
  for (const line of data.additionalUnits) {
    doc.text(`Additional units (${line.range})`, colX[0] + 6, y + 10);
    doc.text(String(line.count), colX[1], y + 10, { align: "right" });
    doc.text(`$${line.rate.toFixed(2)}`, colX[2], y + 10, {
      align: "right",
    });
    doc.text(`$${line.total.toFixed(2)}`, colX[3], y + 10, {
      align: "right",
    });
    y += 18;
  }

  // Divider
  y += 5;
  doc.setDrawColor(200, 200, 200);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 10;

  // Subtotal
  doc.setFont("helvetica", "bold");
  doc.text("Subtotal", colX[2] - 40, y + 10);
  doc.text(`$${data.amount.toFixed(2)}`, colX[3], y + 10, {
    align: "right",
  });
  y += 18;

  // Credits
  if (data.creditAmount > 0) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(22, 163, 74);
    doc.text(
      `Credit${data.creditReason ? ` (${data.creditReason})` : ""}`,
      colX[2] - 40,
      y + 10
    );
    doc.text(`-$${data.creditAmount.toFixed(2)}`, colX[3], y + 10, {
      align: "right",
    });
    y += 18;
  }

  // Adjustments
  if (data.adjustmentAmount > 0) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(217, 119, 6);
    doc.text(
      `Adjustment${data.adjustmentReason ? ` (${data.adjustmentReason})` : ""}`,
      colX[2] - 40,
      y + 10
    );
    doc.text(`-$${data.adjustmentAmount.toFixed(2)}`, colX[3], y + 10, {
      align: "right",
    });
    y += 18;
  }

  // Total
  doc.setDrawColor(200, 200, 200);
  doc.line(colX[2] - 40, y, PAGE_W - MARGIN, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 30, 30);
  doc.text("Total Due", colX[2] - 40, y + 12);
  doc.text(`$${data.netAmount.toFixed(2)}`, colX[3], y + 12, {
    align: "right",
  });
  y += 25;

  // Status
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Status: ${data.status}`, MARGIN, y + 10);
  if (data.paidAt) {
    doc.text(
      `Paid: ${new Date(data.paidAt).toLocaleDateString("en-US")}`,
      MARGIN + 150,
      y + 10
    );
  }
  if (data.paymentMethod) {
    doc.text(`Method: ${data.paymentMethod}`, MARGIN + 320, y + 10);
  }
  y += 30;

  // ── Branded footer ──────────────────────────────
  addFooter(doc, { footerText: `Invoice ${data.invoiceNumber}` });

  return Buffer.from(doc.output("arraybuffer"));
}

import jsPDF from "jspdf";
import fs from "fs";
import path from "path";

// ─── Types ──────────────────────────────────────────

export interface PdfBrandingOptions {
  companyLogo?: string | null;
  companyName?: string | null;
  primaryColor?: string; // hex, default "#5B00FF"
  footerText?: string;
}

export interface FinancialSummaryItem {
  label: string; // "Total Rent Collected"
  value: string; // "$12,450.00"
  prefix?: string; // "-" for expenses
}

export interface DistributionInfo {
  method: string; // "ACH", "Wire", "Check", "Manual"
  date: string | null; // formatted date or null
  status: "PAID" | "PROCESSING" | "APPROVED" | "DRAFT" | "FAILED";
}

export interface PaymentScoreData {
  onTimeRate: number; // 0-100
  consistency: "Excellent" | "Good" | "Fair" | "Poor";
  riskLevel: "Low" | "Medium" | "High";
}

// ─── Helpers ────────────────────────────────────────

export function formatMoney(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

/**
 * Check if content will overflow the page; if so, add a new page and return top margin.
 */
export function checkPageBreak(
  doc: jsPDF,
  currentY: number,
  needed: number
): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (currentY + needed > pageHeight - 30) {
    doc.addPage();
    return 20;
  }
  return currentY;
}

// ─── DoorStax Logo (cached at module level) ─────────

let _doorstaxLogoDataUrl: string | null = null;
let _doorstaxEmblemDataUrl: string | null = null;

export function getDoorstaxLogo(): string | null {
  if (_doorstaxLogoDataUrl) return _doorstaxLogoDataUrl;
  try {
    const logoPath = path.join(process.cwd(), "public", "doorstax-logo.png");
    const buf = fs.readFileSync(logoPath);
    _doorstaxLogoDataUrl = `data:image/png;base64,${buf.toString("base64")}`;
    return _doorstaxLogoDataUrl;
  } catch {
    return null;
  }
}

export function getDoorstaxEmblem(): string | null {
  if (_doorstaxEmblemDataUrl) return _doorstaxEmblemDataUrl;
  try {
    const emblemPath = path.join(
      process.cwd(),
      "public",
      "doorstax-emblem.png"
    );
    const buf = fs.readFileSync(emblemPath);
    _doorstaxEmblemDataUrl = `data:image/png;base64,${buf.toString("base64")}`;
    return _doorstaxEmblemDataUrl;
  } catch {
    return null;
  }
}

// ─── Logo fetcher (for company logos) ───────────────

async function fetchLogoBase64(
  url: string
): Promise<{ dataUrl: string; format: "PNG" | "JPEG" } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const contentType = res.headers.get("content-type") || "image/png";
    const format = contentType.includes("png") ? "PNG" : "JPEG";
    return { dataUrl: `data:${contentType};base64,${base64}`, format };
  } catch {
    return null;
  }
}

// ─── Branding Header ────────────────────────────────

/**
 * Add company branding header to a PDF document.
 * Returns the Y position after the header so content can start below it.
 */
export async function addBrandingHeader(
  doc: jsPDF,
  title: string,
  options: PdfBrandingOptions = {}
): Promise<number> {
  const { companyLogo, companyName, primaryColor = "#5B00FF" } = options;
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 14;
  let logoEndX = 14;

  // Company logo
  if (companyLogo) {
    const logo = await fetchLogoBase64(companyLogo);
    if (logo) {
      doc.addImage(logo.dataUrl, logo.format, 14, 10, 30, 30);
      logoEndX = 50;
    }
  }

  // Company name
  if (companyName) {
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(companyName, logoEndX, yPos + 6);
    yPos += 8;
  }

  // Report title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(title, logoEndX, yPos + 10);
  doc.setFont("helvetica", "normal");
  yPos += 14;

  // "DoorStax Payment Network" with emblem icon
  const emblem = getDoorstaxEmblem();
  if (emblem) {
    doc.addImage(emblem, "PNG", logoEndX, yPos + 0.5, 4, 4);
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("DoorStax Payment Network", logoEndX + 5, yPos + 4);
  } else {
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("DoorStax Payment Network", logoEndX, yPos + 4);
  }
  doc.setTextColor(0, 0, 0);
  yPos += 8;

  // DoorStax logo at top-right (image replaces text-only badge)
  const doorstaxLogo = getDoorstaxLogo();
  if (doorstaxLogo) {
    const dsLogoW = 40;
    const dsLogoH = 8;
    doc.addImage(
      doorstaxLogo,
      "PNG",
      pageWidth - 14 - dsLogoW,
      10,
      dsLogoW,
      dsLogoH
    );
  } else {
    doc.setFontSize(9);
    const [r, g, b] = hexToRgb(primaryColor);
    doc.setTextColor(r, g, b);
    doc.text("DoorStax", pageWidth - 14, 14, { align: "right" });
    doc.setTextColor(0, 0, 0);
  }

  // If logo was present, ensure yPos clears the logo
  if (companyLogo) {
    yPos = Math.max(yPos, 44);
  }

  return yPos;
}

// ─── Accent Line ────────────────────────────────────

export function addAccentLine(
  doc: jsPDF,
  y: number,
  color: string = "#5B00FF"
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const [r, g, b] = hexToRgb(color);
  doc.setDrawColor(r, g, b);
  doc.setLineWidth(1.5);
  doc.line(14, y, pageWidth - 14, y);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  return y + 6;
}

// ─── Footer ─────────────────────────────────────────

export function addFooter(doc: jsPDF, options: PdfBrandingOptions = {}): void {
  const { footerText } = options;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const y = pageHeight - 22;

  // Divider line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(14, y, pageWidth - 14, y);

  doc.setTextColor(130, 130, 130);

  let footerY = y + 5;

  if (footerText) {
    doc.setFontSize(7);
    doc.text(footerText, 14, footerY);
    footerY += 3.5;
  }

  doc.setFontSize(7);
  doc.text(
    "This is a computer-generated document and does not require a signature.",
    14,
    footerY
  );
  footerY += 4;

  // "Certified Transaction Ledger" + "Generated on {date}" with emblem
  const emblem = getDoorstaxEmblem();
  const textX = emblem ? 20 : 14;
  if (emblem) {
    doc.addImage(emblem, "PNG", 14, footerY - 3, 4, 4);
  }
  doc.setFontSize(6.5);
  doc.setTextColor(100, 100, 100);
  doc.text("Certified Transaction Ledger", textX, footerY);
  footerY += 3;
  doc.text(
    `Generated on ${new Date().toLocaleDateString()} | DoorStax Payment Network`,
    textX,
    footerY
  );
  doc.setTextColor(0, 0, 0);
}

// ─── Certification Header ───────────────────────────

export async function addCertificationHeader(
  doc: jsPDF,
  title: string,
  certId: string,
  options: PdfBrandingOptions = {}
): Promise<number> {
  const { primaryColor = "#5B00FF" } = options;
  const pageWidth = doc.internal.pageSize.getWidth();

  const yAfterBranding = await addBrandingHeader(doc, title, options);

  const [r, g, b] = hexToRgb(primaryColor);
  doc.setFillColor(r, g, b);
  doc.roundedRect(14, yAfterBranding, pageWidth - 28, 16, 3, 3, "F");

  const emblem = getDoorstaxEmblem();
  const textStartX = emblem ? 28 : 20;

  if (emblem) {
    doc.addImage(emblem, "PNG", 17, yAfterBranding + 3, 10, 10);
  }

  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("DoorStax Certified Document", textStartX, yAfterBranding + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`ID: ${certId}`, textStartX, yAfterBranding + 12);
  doc.setTextColor(0, 0, 0);

  return yAfterBranding + 22;
}

// ─── Financial Summary Block (Stripe-style) ─────────

/**
 * Draws a Stripe-style summary block with large bold numbers.
 * Returns Y position after the block.
 */
export function drawFinancialSummaryBlock(
  doc: jsPDF,
  y: number,
  items: FinancialSummaryItem[],
  primaryColor: string
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const blockWidth = pageWidth - 28;
  const blockHeight = 36;
  const [pr, pg, pb] = hexToRgb(primaryColor);

  // Background card
  doc.setFillColor(248, 248, 252);
  doc.setDrawColor(230, 230, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, y, blockWidth, blockHeight, 3, 3, "FD");

  const colWidth = blockWidth / items.length;

  items.forEach((item, i) => {
    const x = 14 + i * colWidth;

    // Vertical divider
    if (i > 0) {
      doc.setDrawColor(220, 220, 230);
      doc.setLineWidth(0.3);
      doc.line(x, y + 6, x, y + blockHeight - 6);
    }

    // Label
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(item.label, x + 8, y + 12);

    // Value
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    if (item.prefix === "-") {
      doc.setTextColor(180, 60, 60); // red for expenses
    } else if (i === items.length - 1) {
      doc.setTextColor(pr, pg, pb); // primary for net
    } else {
      doc.setTextColor(40, 40, 40); // dark for gross
    }
    doc.text(item.value, x + 8, y + 26);
  });

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  return y + blockHeight + 8;
}

// ─── Property Section Header ────────────────────────

/**
 * Draws a property section header with colored left accent bar and subtotal.
 */
export function drawPropertySectionHeader(
  doc: jsPDF,
  y: number,
  propertyName: string,
  subtotal: string,
  primaryColor: string
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const [pr, pg, pb] = hexToRgb(primaryColor);

  // Light background
  doc.setFillColor(248, 246, 255);
  doc.roundedRect(14, y, pageWidth - 28, 14, 2, 2, "F");

  // Left accent bar
  doc.setFillColor(pr, pg, pb);
  doc.rect(14, y, 3, 14, "F");

  // Property name
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text(propertyName, 22, y + 9);

  // Subtotal
  doc.setFontSize(9);
  doc.setTextColor(pr, pg, pb);
  doc.text(`Total: ${subtotal}`, pageWidth - 18, y + 9, { align: "right" });

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  return y + 18;
}

// ─── Distribution Confirmation ──────────────────────

/**
 * Draws a financial settlement / distribution confirmation block.
 */
export function drawDistributionConfirmation(
  doc: jsPDF,
  y: number,
  info: DistributionInfo,
  primaryColor: string
): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Section title
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text("Distribution Confirmation", 14, y);
  doc.setFont("helvetica", "normal");
  y += 6;

  const statusMap: Record<
    string,
    { label: string; color: [number, number, number] }
  > = {
    PAID: { label: "Completed", color: [34, 139, 34] },
    PROCESSING: { label: "Processing", color: [200, 150, 0] },
    APPROVED: { label: "Pending", color: [100, 100, 180] },
    DRAFT: { label: "Pending", color: [150, 150, 150] },
    FAILED: { label: "Failed", color: [200, 50, 50] },
  };

  const statusInfo = statusMap[info.status] || statusMap.DRAFT;

  const cols = [
    { label: "Deposit Method", value: info.method },
    { label: "Distribution Date", value: info.date || "Pending" },
    { label: "Settlement Status", value: statusInfo.label },
  ];

  // Background
  doc.setFillColor(250, 250, 252);
  doc.setDrawColor(230, 230, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, y, pageWidth - 28, 22, 2, 2, "FD");

  const colWidth = (pageWidth - 28) / cols.length;
  cols.forEach((col, i) => {
    const x = 14 + i * colWidth + 8;

    // Label
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(col.label, x, y + 8);

    // Value
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    if (i === 2) {
      doc.setTextColor(...statusInfo.color);
    } else {
      doc.setTextColor(40, 40, 40);
    }
    doc.text(col.value, x, y + 17);
  });

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  return y + 30;
}

// ─── Payment Score Block ────────────────────────────

function drawScoreColumn(
  doc: jsPDF,
  x: number,
  y: number,
  label: string,
  value: string,
  color: [number, number, number]
): void {
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(label, x, y + 10);

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...color);
  doc.text(value, x, y + 21);
}

/**
 * Draws a DoorStax Payment Score block for certified rent records.
 */
export function drawPaymentScoreBlock(
  doc: jsPDF,
  y: number,
  score: PaymentScoreData,
  primaryColor: string
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const [pr, pg, pb] = hexToRgb(primaryColor);

  // Section title
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text("DoorStax Payment Score", 14, y);
  doc.setFont("helvetica", "normal");
  y += 6;

  // Background with primary-color border
  doc.setFillColor(245, 243, 255);
  doc.setDrawColor(pr, pg, pb);
  doc.setLineWidth(0.5);
  doc.roundedRect(14, y, pageWidth - 28, 28, 3, 3, "FD");

  const colWidth = (pageWidth - 28) / 3;

  // On-Time Payment Rate
  const rateColor: [number, number, number] =
    score.onTimeRate >= 90
      ? [34, 139, 34]
      : score.onTimeRate >= 70
        ? [200, 150, 0]
        : [200, 50, 50];
  drawScoreColumn(doc, 22, y, "On-Time Payment Rate", `${score.onTimeRate}%`, rateColor);

  // Payment Consistency
  const consistencyColor: [number, number, number] =
    score.consistency === "Excellent"
      ? [34, 139, 34]
      : score.consistency === "Good"
        ? [60, 130, 60]
        : score.consistency === "Fair"
          ? [200, 150, 0]
          : [200, 50, 50];
  drawScoreColumn(doc, 22 + colWidth, y, "Payment Consistency", score.consistency, consistencyColor);

  // Tenant Risk Level
  const riskColor: [number, number, number] =
    score.riskLevel === "Low"
      ? [34, 139, 34]
      : score.riskLevel === "Medium"
        ? [200, 150, 0]
        : [200, 50, 50];
  drawScoreColumn(doc, 22 + colWidth * 2, y, "Tenant Risk Level", score.riskLevel, riskColor);

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  return y + 36;
}

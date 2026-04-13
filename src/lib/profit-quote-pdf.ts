/**
 * DoorStax Pricing Proposal — Gold-standard branded PDF.
 *
 * Uses the shared pdf-utils branding system (same as owner payout
 * statements) for a consistent, polished fintech look. This is a
 * client-facing sales document — the first thing a prospect sees.
 */

import jsPDF from "jspdf";
import {
  addBrandingHeader,
  addAccentLine,
  addFooter,
  drawFinancialSummaryBlock,
  checkPageBreak,
  formatMoney,
  hexToRgb,
  type FinancialSummaryItem,
} from "./pdf-utils";

const PRIMARY = "#5B00FF";

export interface QuotePdfData {
  prospectName: string;
  prospectEmail?: string;
  prospectCompany?: string;
  units: number;
  avgRent: number;
  occupancyPct: number;
  cardPct: number;
  mgmtFeePct: number;
  tierName: string;
  softwareCost: number;
  perUnitCost: number;
  pmCardEarnings: number;
  pmAchEarnings: number;
  totalPmPaymentEarnings: number;
  pmNetCostOrProfit: number;
  pmPaymentsCoverSoftware: boolean;
  mgmtFeeEarnings: number;
  pmTotalNetIncome: number;
  quoteId: string;
  preparedBy: string;
  preparedDate: Date;
  validUntil: Date;
}

export async function generateProfitQuotePdf(
  d: QuotePdfData
): Promise<Buffer> {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const M = 14;
  const [pr, pg, pb] = hexToRgb(PRIMARY);

  // ── 1. Branded header ───────────────────────────────
  let y = await addBrandingHeader(doc, "Pricing Proposal", {
    primaryColor: PRIMARY,
  });
  y = addAccentLine(doc, y, PRIMARY);

  // ── 2. Quote metadata ──────────────────────────────
  y += 4;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text(`Quote #${d.quoteId}`, W - M, y, { align: "right" });
  y += 11;
  doc.text(
    `Prepared: ${d.preparedDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
    W - M,
    y,
    { align: "right" }
  );
  y += 11;
  doc.text(
    `Valid until: ${d.validUntil.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
    W - M,
    y,
    { align: "right" }
  );

  // Prepared for / by
  const metaStartY = y - 22;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text("Prepared For", M, metaStartY);
  doc.setFont("helvetica", "normal");
  doc.text(d.prospectName, M, metaStartY + 12);
  if (d.prospectCompany) {
    doc.setTextColor(100, 100, 100);
    doc.text(d.prospectCompany, M, metaStartY + 23);
  }
  if (d.prospectEmail) {
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(9);
    doc.text(d.prospectEmail, M, metaStartY + (d.prospectCompany ? 34 : 23));
  }
  y += 20;

  // ── 3. Portfolio summary — Stripe-style KPI card ────
  y = checkPageBreak(doc, y, 60);
  const portfolioItems: FinancialSummaryItem[] = [
    { label: "Units Under Management", value: d.units.toLocaleString() },
    { label: "Average Monthly Rent", value: "$" + formatMoney(d.avgRent) },
    { label: "Estimated Occupancy", value: d.occupancyPct + "%" },
  ];
  y = drawFinancialSummaryBlock(doc, y, portfolioItems, PRIMARY);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(pr, pg, pb);
  doc.text(`${d.tierName} Tier \u00b7 $${d.perUnitCost.toFixed(2)}/unit`, M, y);
  y += 14;

  // ── 4. Your Investment ──────────────────────────────
  y = checkPageBreak(doc, y, 60);
  drawSectionHeader(doc, y, "Your Investment");
  y += 20;

  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  const costText = "$" + formatMoney(d.softwareCost);
  doc.text(costText, M + 8, y);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("/month", M + 8 + doc.getTextWidth(costText) + 4, y);
  y += 14;

  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `${d.units.toLocaleString()} units \u00d7 $${d.perUnitCost.toFixed(2)}/unit \u2014 ${d.tierName} tier, graduated pricing`,
    M + 8,
    y
  );
  y += 8;
  doc.text("Base: $150.00 (first 50 units) + graduated per-unit above 50", M + 8, y);
  y += 20;

  // ── 5. Your Potential Earnings — KPI card ───────────
  y = checkPageBreak(doc, y, 60);
  drawSectionHeader(doc, y, "Your Potential Earnings");
  y += 20;

  const earningsItems: FinancialSummaryItem[] = [
    { label: "Card Processing", value: "+$" + formatMoney(d.pmCardEarnings) },
    { label: "ACH Processing", value: "+$" + formatMoney(d.pmAchEarnings) },
    { label: "Total Monthly Earnings", value: "+$" + formatMoney(d.totalPmPaymentEarnings) },
  ];
  y = drawFinancialSummaryBlock(doc, y, earningsItems, PRIMARY);

  // ── 6. The Bottom Line — highlight box ──────────────
  y = checkPageBreak(doc, y, 50);
  const boxH = 44;
  if (d.pmPaymentsCoverSoftware) {
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(34, 197, 94);
  } else {
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(239, 68, 68);
  }
  doc.setLineWidth(0.8);
  doc.roundedRect(M, y, W - M * 2, boxH, 4, 4, "FD");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text(
    d.pmPaymentsCoverSoftware
      ? "Payment earnings MORE than cover your software cost"
      : "Your net software cost after payment earnings",
    M + 12,
    y + 16
  );

  doc.setFontSize(20);
  if (d.pmNetCostOrProfit >= 0) {
    doc.setTextColor(16, 185, 129);
  } else {
    doc.setTextColor(239, 68, 68);
  }
  doc.text(
    (d.pmNetCostOrProfit >= 0 ? "+" : "-") +
      "$" +
      formatMoney(Math.abs(d.pmNetCostOrProfit)) +
      "/month",
    M + 12,
    y + 34
  );
  y += boxH + 14;

  // ── 7. Total Monthly Income ─────────────────────────
  y = checkPageBreak(doc, y, 80);
  drawSectionHeader(doc, y, "Your Total Monthly Income with DoorStax");
  y += 20;

  const incomeRows: { label: string; value: string; color: readonly [number, number, number] }[] = [
    { label: `Management Fees (${d.mgmtFeePct}%)`, value: "$" + formatMoney(d.mgmtFeeEarnings), color: [40, 40, 40] },
    { label: "Payment Processing Earnings", value: "+$" + formatMoney(d.totalPmPaymentEarnings), color: [16, 185, 129] },
    { label: "DoorStax Platform Cost", value: "-$" + formatMoney(d.softwareCost), color: [239, 68, 68] },
  ];
  for (const row of incomeRows) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(row.label, M + 8, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...row.color);
    doc.text(row.value, W - M - 8, y, { align: "right" });
    y += 14;
  }

  doc.setDrawColor(pr, pg, pb);
  doc.setLineWidth(0.5);
  doc.line(M, y, W - M, y);
  y += 14;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(16, 185, 129);
  doc.text("Net Monthly Income: $" + formatMoney(d.pmTotalNetIncome), M + 8, y);
  y += 12;
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.setFont("helvetica", "normal");
  doc.text("$" + formatMoney(d.pmTotalNetIncome * 12) + " annually", M + 8, y);
  y += 24;

  // ── 8. What's Included ──────────────────────────────
  y = checkPageBreak(doc, y, 100);
  drawSectionHeader(doc, y, "What\u2019s Included");
  y += 18;

  const features = [
    "Full property management dashboard",
    "Tenant portal with online rent payments (card + ACH)",
    "Custom application forms with digital signatures",
    "Tenant screening via RentSpree integration",
    "Double-entry accounting engine with financial reports",
    "Owner statements and automated payouts",
    "Expense tracking with tenant invoicing",
    "Maintenance ticket system",
    "Parking management with split billing",
    "Team management with role-based permissions",
    "31 branded email templates",
    "24/7 payment processing via Kadima Payments",
  ];

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  for (const feature of features) {
    y = checkPageBreak(doc, y, 12);
    doc.setTextColor(pr, pg, pb);
    doc.text("\u2713", M + 10, y);
    doc.setTextColor(60, 60, 60);
    doc.text(feature, M + 22, y);
    y += 12;
  }
  y += 12;

  // ── 9. Tier Progression ─────────────────────────────
  y = checkPageBreak(doc, y, 50);
  drawSectionHeader(doc, y, "As You Grow, You Earn More");
  y += 18;

  // Table header
  doc.setFillColor(248, 248, 252);
  doc.rect(M, y - 2, W - M * 2, 14, "F");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 100, 100);
  const cx = [M + 8, M + 80, M + 160, M + 260, M + 370];
  doc.text("Tier", cx[0], y + 8);
  doc.text("Units", cx[1], y + 8);
  doc.text("Software/Unit", cx[2], y + 8);
  doc.text("Card Earnings", cx[3], y + 8);
  doc.text("ACH Platform Cost", cx[4], y + 8);
  y += 16;

  const tiers = [
    ["Starter", "0\u201399", "$3.00", "\u2014", "$6.00 (locked)"],
    ["Growth", "100\u2013499", "$2.50", "0.25%", "$4.00"],
    ["Scale", "500\u2013999", "$2.00", "0.30%", "$3.00"],
    ["Enterprise", "1,000+", "$1.50", "0.35%", "$2.00"],
  ];

  doc.setFontSize(8);
  for (const row of tiers) {
    const isCurrent = row[0] === d.tierName;
    if (isCurrent) {
      doc.setFillColor(245, 243, 255);
      doc.rect(M, y - 3, W - M * 2, 12, "F");
      doc.setFont("helvetica", "bold");
      doc.setTextColor(pr, pg, pb);
    } else {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
    }
    doc.text(row[0], cx[0], y + 6);
    doc.text(row[1], cx[1], y + 6);
    doc.text(row[2], cx[2], y + 6);
    doc.text(row[3], cx[3], y + 6);
    doc.text(row[4], cx[4], y + 6);
    y += 14;
  }

  // ── Footer ──────────────────────────────────────────
  addFooter(doc, {
    footerText: `Quote #${d.quoteId} \u00b7 Valid until ${d.validUntil.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
  });

  return Buffer.from(doc.output("arraybuffer"));
}

/* ── Section header with left accent bar ──────────── */
function drawSectionHeader(doc: jsPDF, y: number, title: string): void {
  const [r, g, b] = hexToRgb(PRIMARY);
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(248, 246, 255);
  doc.rect(14, y, W - 28, 14, "F");
  doc.setFillColor(r, g, b);
  doc.rect(14, y, 3, 14, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text(title, 22, y + 10);
}

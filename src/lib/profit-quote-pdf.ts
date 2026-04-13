/**
 * DoorStax Pricing Proposal — Gold-standard branded PDF.
 *
 * Uses the shared pdf-utils branding system for consistent fintech look.
 * Client-facing sales document — the first thing a prospect sees.
 *
 * NOTE: formatMoney() from pdf-utils already includes the "$" sign.
 * Never prefix with "$" when using formatMoney().
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

/** Format number WITHOUT $ sign (for when we prefix manually) */
function fmtNum(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

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
  currentSoftwareCost?: number;
  softwareSavings?: number;
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
  const RM = W - M; // right margin
  const [pr, pg, pb] = hexToRgb(PRIMARY);

  // ── 1. Branded header ───────────────────────────────
  let y = await addBrandingHeader(doc, "Pricing Proposal", {
    primaryColor: PRIMARY,
  });
  y = addAccentLine(doc, y, PRIMARY);

  // ── 2. Quote metadata + who sent it ─────────────────
  y += 6;

  // Left side: Prepared for
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(120, 120, 120);
  doc.text("PREPARED FOR", M, y);
  y += 10;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text(d.prospectName, M, y);
  y += 11;
  if (d.prospectCompany) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(d.prospectCompany, M, y);
    y += 10;
  }
  if (d.prospectEmail) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(d.prospectEmail, M, y);
    y += 10;
  }

  // Right side: Prepared by + quote info (at same vertical range)
  const rightTopY = y - (d.prospectCompany ? 41 : 31);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(120, 120, 120);
  doc.text("PREPARED BY", RM, rightTopY, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.text(d.preparedBy, RM, rightTopY + 10, { align: "right" });
  doc.setTextColor(120, 120, 120);
  doc.text("Quote #" + d.quoteId, RM, rightTopY + 21, { align: "right" });
  doc.text(
    d.preparedDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    RM,
    rightTopY + 32,
    { align: "right" }
  );
  doc.text(
    "Valid until " +
      d.validUntil.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    RM,
    rightTopY + 43,
    { align: "right" }
  );

  y += 8;

  // ── 3. Portfolio summary — Stripe-style KPI card ────
  y = checkPageBreak(doc, y, 60);
  const portfolioItems: FinancialSummaryItem[] = [
    { label: "Units Under Management", value: d.units.toLocaleString() },
    { label: "Average Monthly Rent", value: formatMoney(d.avgRent) },
    { label: "Estimated Occupancy", value: d.occupancyPct + "%" },
  ];
  y = drawFinancialSummaryBlock(doc, y, portfolioItems, PRIMARY);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(pr, pg, pb);
  doc.text(
    d.tierName + " Tier  |  $" + d.perUnitCost.toFixed(2) + "/unit",
    M,
    y
  );
  y += 16;

  // ── 4. Your Investment ──────────────────────────────
  y = checkPageBreak(doc, y, 70);
  drawSectionHeader(doc, y, "Your Investment");
  y += 22;

  // Large price — use fmtNum (no $) so we can prefix cleanly
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  const priceText = "$" + fmtNum(d.softwareCost);
  doc.text(priceText, M + 8, y);

  // "/month" suffix — measure at 28pt, then switch font
  const priceWidth = doc.getTextWidth(priceText);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(130, 130, 130);
  doc.text(" /month", M + 8 + priceWidth, y);
  y += 16;

  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(
    d.units.toLocaleString() +
      " units x $" +
      d.perUnitCost.toFixed(2) +
      "/unit  —  " +
      d.tierName +
      " tier, graduated pricing",
    M + 8,
    y
  );
  y += 10;
  doc.text(
    "Base: $150.00 (first 50 units) + graduated per-unit above 50",
    M + 8,
    y
  );
  y += 20;

  // ── 5. Your Potential Earnings — KPI card ───────────
  y = checkPageBreak(doc, y, 60);
  drawSectionHeader(doc, y, "Your Potential Earnings");
  y += 22;

  const earningsItems: FinancialSummaryItem[] = [
    {
      label: "Card Processing",
      value: "+$" + fmtNum(d.pmCardEarnings),
    },
    {
      label: "ACH Processing",
      value: "+$" + fmtNum(d.pmAchEarnings),
    },
    {
      label: "Total Monthly Earnings",
      value: "+$" + fmtNum(d.totalPmPaymentEarnings),
    },
  ];
  y = drawFinancialSummaryBlock(doc, y, earningsItems, PRIMARY);

  // ── 6. The Bottom Line — highlight box ──────────────
  y = checkPageBreak(doc, y, 55);
  const boxH = 48;
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
  doc.setTextColor(60, 60, 60);
  doc.text(
    d.pmPaymentsCoverSoftware
      ? "Payment earnings MORE than cover your software cost"
      : "Your net software cost after payment earnings",
    M + 14,
    y + 18
  );

  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  if (d.pmNetCostOrProfit >= 0) {
    doc.setTextColor(16, 185, 129);
    doc.text(
      "+$" + fmtNum(d.pmNetCostOrProfit) + "/month",
      M + 14,
      y + 38
    );
  } else {
    doc.setTextColor(239, 68, 68);
    doc.text(
      "-$" + fmtNum(Math.abs(d.pmNetCostOrProfit)) + "/month",
      M + 14,
      y + 38
    );
  }
  y += boxH + 16;

  // ── 6b. Software Savings (if switching from another provider) ──
  const hasSavings = (d.currentSoftwareCost ?? 0) > 0;
  if (hasSavings) {
    y = checkPageBreak(doc, y, 50);
    drawSectionHeader(doc, y, "Software Switch Savings");
    y += 22;

    const savingsRows: { label: string; value: string; color: [number, number, number] }[] = [
      { label: "Current software cost", value: "$" + fmtNum(d.currentSoftwareCost ?? 0), color: [100, 100, 100] },
      { label: "DoorStax cost", value: "$" + fmtNum(d.softwareCost), color: [40, 40, 40] },
    ];
    const savings = d.softwareSavings ?? 0;
    if (savings >= 0) {
      savingsRows.push({ label: "Monthly savings", value: "$" + fmtNum(savings), color: [16, 185, 129] });
    } else {
      savingsRows.push({ label: "Additional cost", value: "+$" + fmtNum(Math.abs(savings)), color: [239, 68, 68] });
    }
    for (const row of savingsRows) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(row.label, M + 8, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(row.color[0], row.color[1], row.color[2]);
      doc.text(row.value, RM - 8, y, { align: "right" });
      y += 15;
    }
    if (savings > 0) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(16, 185, 129);
      doc.text("Saves $" + fmtNum(savings * 12) + "/year just from switching", M + 8, y);
      y += 8;
    }
    y += 10;
  }

  // ── 7. Total Monthly Income ─────────────────────────
  y = checkPageBreak(doc, y, 90);
  drawSectionHeader(doc, y, "Your Total Monthly Income with DoorStax");
  y += 22;

  const incomeRows: {
    label: string;
    value: string;
    color: [number, number, number];
  }[] = [
    {
      label: "Management Fees (" + d.mgmtFeePct + "%)",
      value: formatMoney(d.mgmtFeeEarnings),
      color: [40, 40, 40],
    },
    {
      label: "Payment Processing Earnings",
      value: "+$" + fmtNum(d.totalPmPaymentEarnings),
      color: [16, 185, 129],
    },
  ];
  if (hasSavings && (d.softwareSavings ?? 0) > 0) {
    incomeRows.push({
      label: "Software Savings vs Current Provider",
      value: "+$" + fmtNum(d.softwareSavings ?? 0),
      color: [37, 99, 235],
    });
  }
  incomeRows.push({
    label: "DoorStax Platform Cost",
    value: "-$" + fmtNum(d.softwareCost),
    color: [239, 68, 68],
  });
  for (const row of incomeRows) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(row.label, M + 8, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(row.color[0], row.color[1], row.color[2]);
    doc.text(row.value, RM - 8, y, { align: "right" });
    y += 15;
  }

  // Divider
  doc.setDrawColor(pr, pg, pb);
  doc.setLineWidth(0.5);
  doc.line(M, y + 2, RM, y + 2);
  y += 16;

  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(16, 185, 129);
  doc.text("Net Monthly Income: " + formatMoney(d.pmTotalNetIncome), M + 8, y);
  y += 13;
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.setFont("helvetica", "normal");
  doc.text(formatMoney(d.pmTotalNetIncome * 12) + " annually", M + 8, y);
  y += 26;

  // ── 8. What's Included — 2-COLUMN LAYOUT ───────────
  y = checkPageBreak(doc, y, 80);
  drawSectionHeader(doc, y, "What's Included");
  y += 18;

  const features = [
    "Property management dashboard",
    "Online rent payments (card + ACH)",
    "Custom applications + e-signatures",
    "Tenant screening (RentSpree)",
    "Double-entry accounting engine",
    "Owner statements + auto payouts",
    "Expense tracking + invoicing",
    "Maintenance ticket system",
    "Parking management",
    "Team + role-based permissions",
    "31 branded email templates",
    "24/7 Kadima payment processing",
  ];

  const colMid = (W - M * 2) / 2 + M;
  doc.setFontSize(8.5);
  for (let i = 0; i < features.length; i += 2) {
    y = checkPageBreak(doc, y, 12);
    // Left column
    doc.setFont("helvetica", "bold");
    doc.setTextColor(pr, pg, pb);
    doc.text("-", M + 8, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text(features[i], M + 18, y);
    // Right column
    if (i + 1 < features.length) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(pr, pg, pb);
      doc.text("-", colMid + 4, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      doc.text(features[i + 1], colMid + 14, y);
    }
    y += 12;
  }
  y += 12;

  // ── 9. Tier Progression ─────────────────────────────
  y = checkPageBreak(doc, y, 60);
  drawSectionHeader(doc, y, "As You Grow, You Earn More");
  y += 20;

  // Table header
  doc.setFillColor(248, 248, 252);
  doc.rect(M, y - 2, W - M * 2, 14, "F");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 100, 100);
  const cx = [M + 8, M + 80, M + 170, M + 280, M + 390];
  doc.text("Tier", cx[0], y + 8);
  doc.text("Units", cx[1], y + 8);
  doc.text("Software/Unit", cx[2], y + 8);
  doc.text("Card Earnings", cx[3], y + 8);
  doc.text("ACH Platform Cost", cx[4], y + 8);
  y += 16;

  const tiers = [
    ["Starter", "0-99", "$3.00", "--", "$6.00 (locked)"],
    ["Growth", "100-499", "$2.50", "0.25%", "$4.00"],
    ["Scale", "500-999", "$2.00", "0.30%", "$3.00"],
    ["Enterprise", "1,000+", "$1.50", "0.35%", "$2.00"],
  ];

  doc.setFontSize(8);
  for (const row of tiers) {
    const isCurrent = row[0] === d.tierName;
    if (isCurrent) {
      doc.setFillColor(245, 243, 255);
      doc.rect(M, y - 3, W - M * 2, 13, "F");
      doc.setFont("helvetica", "bold");
      doc.setTextColor(pr, pg, pb);
    } else {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
    }
    doc.text(row[0], cx[0], y + 7);
    doc.text(row[1], cx[1], y + 7);
    doc.text(row[2], cx[2], y + 7);
    doc.text(row[3], cx[3], y + 7);
    doc.text(row[4], cx[4], y + 7);
    y += 15;
  }

  // ── Footer ──────────────────────────────────────────
  addFooter(doc, {
    footerText:
      "Quote #" +
      d.quoteId +
      "  |  Valid until " +
      d.validUntil.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
  });

  return Buffer.from(doc.output("arraybuffer"));
}

/* ── Section header with left accent bar ──────────── */
function drawSectionHeader(doc: jsPDF, y: number, title: string): void {
  const [r, g, b] = hexToRgb(PRIMARY);
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(248, 246, 255);
  doc.rect(14, y, W - 28, 15, "F");
  doc.setFillColor(r, g, b);
  doc.rect(14, y, 3, 15, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text(title, 23, y + 11);
}

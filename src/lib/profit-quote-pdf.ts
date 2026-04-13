/**
 * DoorStax Pricing Proposal PDF — presentation-quality layout.
 *
 * Built for live sales calls. Every element has explicit positioning
 * with generous spacing. No text overlap, no bleeding, no cramming.
 *
 * NOTE: formatMoney() includes "$". fmtNum() does not.
 */

import jsPDF from "jspdf";

const PURPLE: [number, number, number] = [91, 0, 255];
const DARK: [number, number, number] = [30, 30, 30];
const GRAY: [number, number, number] = [120, 120, 120];
const GREEN: [number, number, number] = [16, 185, 129];
const RED: [number, number, number] = [239, 68, 68];
const BLUE: [number, number, number] = [37, 99, 235];

function fmt(n: number): string {
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
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const PW = doc.internal.pageSize.getWidth(); // ~215.9mm
  const PH = doc.internal.pageSize.getHeight(); // ~279.4mm
  const ML = 15; // left margin
  const MR = PW - 15; // right margin
  const CW = MR - ML; // content width

  let y = 15;

  // ─── PAGE BREAK HELPER ──────────────────────────────
  function ensureSpace(needed: number) {
    if (y + needed > PH - 20) {
      doc.addPage();
      y = 15;
    }
  }

  // ─── SECTION HEADER HELPER ──────────────────────────
  function sectionHeader(title: string) {
    ensureSpace(30);
    y += 6;
    // Background
    doc.setFillColor(248, 246, 255);
    doc.rect(ML, y, CW, 6, "F");
    // Purple accent bar
    doc.setFillColor(...PURPLE);
    doc.rect(ML, y, 1, 6, "F");
    // Title text
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text(title, ML + 4, y + 4.2);
    y += 9;
  }

  // ─── ROW HELPER ─────────────────────────────────────
  function row(
    label: string,
    value: string,
    color: [number, number, number] = DARK
  ) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY);
    doc.text(label, ML + 3, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...color);
    doc.text(value, MR - 3, y, { align: "right" });
    y += 5;
  }

  // ─── STAT CARD HELPER ──────────────────────────────
  function statCard(
    x: number,
    w: number,
    label: string,
    value: string,
    color: [number, number, number] = DARK
  ) {
    doc.setFillColor(248, 247, 255);
    doc.setDrawColor(228, 226, 240);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, w, 11, 1, 1, "FD");
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY);
    doc.text(label, x + 2.5, y + 3.5);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...color);
    doc.text(value, x + 2.5, y + 9);
  }

  // ═══════════════════════════════════════════════════
  // HEADER
  // ═══════════════════════════════════════════════════
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PURPLE);
  doc.text("DoorStax", ML, y + 5);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  doc.text("Pricing Proposal", ML, y + 9);

  // Right: Prepared by
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...GRAY);
  doc.text("PREPARED BY", MR, y, { align: "right" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...DARK);
  doc.text(d.preparedBy, MR, y + 4, { align: "right" });
  doc.setTextColor(...GRAY);
  doc.text("Quote #" + d.quoteId, MR, y + 8, { align: "right" });
  const dateStr = d.preparedDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const validStr = d.validUntil.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  doc.text(dateStr, MR, y + 12, { align: "right" });
  doc.text("Valid until " + validStr, MR, y + 16, { align: "right" });

  y += 22;

  // Prepared for
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...GRAY);
  doc.text("PREPARED FOR", ML, y);
  y += 4;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  const forLine =
    d.prospectName + (d.prospectCompany ? "  —  " + d.prospectCompany : "");
  doc.text(forLine, ML, y);
  y += 4;
  if (d.prospectEmail) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY);
    doc.text(d.prospectEmail, ML, y);
    y += 3;
  }

  // Accent line
  y += 3;
  doc.setDrawColor(...PURPLE);
  doc.setLineWidth(0.4);
  doc.line(ML, y, MR, y);
  y += 6;

  // ═══════════════════════════════════════════════════
  // PORTFOLIO SUMMARY — 3 stat cards
  // ═══════════════════════════════════════════════════
  ensureSpace(20);
  const cw3 = (CW - 4) / 3;
  statCard(ML, cw3, "Units Under Management", String(d.units));
  statCard(ML + cw3 + 2, cw3, "Average Monthly Rent", "$" + fmt(d.avgRent));
  statCard(ML + (cw3 + 2) * 2, cw3, "Estimated Occupancy", d.occupancyPct + "%");
  y += 13;

  // Tier badge
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PURPLE);
  doc.text(
    d.tierName + " Tier  |  $" + d.perUnitCost.toFixed(2) + "/unit",
    ML,
    y
  );
  y += 4;

  // ═══════════════════════════════════════════════════
  // YOUR INVESTMENT
  // ═══════════════════════════════════════════════════
  sectionHeader("Your Investment");

  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  const priceTxt = "$" + fmt(d.softwareCost);
  doc.text(priceTxt, ML + 3, y);
  // Measure at current font size before changing
  const pw = doc.getTextWidth(priceTxt);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  doc.text(" /month", ML + 3 + pw, y);
  y += 5;

  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(
    d.units.toLocaleString() +
      " units x $" +
      d.perUnitCost.toFixed(2) +
      "/unit — " +
      d.tierName +
      " tier, graduated pricing",
    ML + 3,
    y
  );
  y += 3.5;
  doc.text(
    "Base: $150 (first 50 units) + graduated per-unit above 50",
    ML + 3,
    y
  );
  y += 4;

  // ═══════════════════════════════════════════════════
  // YOUR POTENTIAL EARNINGS — 3 stat cards
  // ═══════════════════════════════════════════════════
  sectionHeader("Your Potential Earnings");

  statCard(ML, cw3, "Card Processing", "+$" + fmt(d.pmCardEarnings), GREEN);
  statCard(
    ML + cw3 + 2,
    cw3,
    "ACH Processing",
    "+$" + fmt(d.pmAchEarnings),
    GREEN
  );
  statCard(
    ML + (cw3 + 2) * 2,
    cw3,
    "Total Monthly Earnings",
    "+$" + fmt(d.totalPmPaymentEarnings),
    GREEN
  );
  y += 14;

  // ═══════════════════════════════════════════════════
  // NET RESULT — highlight box
  // ═══════════════════════════════════════════════════
  ensureSpace(20);
  const boxH = 14;
  if (d.pmPaymentsCoverSoftware) {
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(34, 197, 94);
  } else {
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(...RED);
  }
  doc.setLineWidth(0.4);
  doc.roundedRect(ML, y, CW, boxH, 1.5, 1.5, "FD");

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text(
    d.pmPaymentsCoverSoftware
      ? "Payment earnings MORE than cover your software cost"
      : "Net software cost after payment earnings",
    ML + 4,
    y + 4.5
  );

  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...(d.pmPaymentsCoverSoftware ? GREEN : RED));
  const sign = d.pmNetCostOrProfit >= 0 ? "+" : "-";
  doc.text(
    sign + "$" + fmt(Math.abs(d.pmNetCostOrProfit)) + "/month",
    ML + 4,
    y + 11.5
  );
  y += boxH + 4;

  // ═══════════════════════════════════════════════════
  // SOFTWARE SAVINGS (optional)
  // ═══════════════════════════════════════════════════
  const hasSavings = (d.currentSoftwareCost ?? 0) > 0;
  if (hasSavings) {
    sectionHeader("Software Switch Savings");
    const sav = d.softwareSavings ?? 0;
    row("Current software cost", "$" + fmt(d.currentSoftwareCost ?? 0), GRAY);
    row("DoorStax cost", "$" + fmt(d.softwareCost));
    if (sav >= 0) {
      row("Monthly savings", "$" + fmt(sav), GREEN);
    } else {
      row("Additional cost", "+$" + fmt(Math.abs(sav)), RED);
    }
    if (sav > 0) {
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GREEN);
      doc.text(
        "Saves $" + fmt(sav * 12) + "/year just from switching",
        ML + 3,
        y
      );
      y += 4;
    }
    y += 2;
  }

  // ═══════════════════════════════════════════════════
  // TOTAL MONTHLY INCOME
  // ═══════════════════════════════════════════════════
  sectionHeader("Your Total Monthly Income with DoorStax");

  row("Management Fees (" + d.mgmtFeePct + "%)", "$" + fmt(d.mgmtFeeEarnings));
  row("Payment Processing Earnings", "+$" + fmt(d.totalPmPaymentEarnings), GREEN);
  if (hasSavings && (d.softwareSavings ?? 0) > 0) {
    row("Software Savings vs Current Provider", "+$" + fmt(d.softwareSavings ?? 0), BLUE);
  }
  row("DoorStax Platform Cost", "-$" + fmt(d.softwareCost), RED);

  // Divider
  y += 1;
  doc.setDrawColor(...PURPLE);
  doc.setLineWidth(0.3);
  doc.line(ML, y, MR, y);
  y += 5;

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...GREEN);
  doc.text("Net Monthly Income: $" + fmt(d.pmTotalNetIncome), ML + 3, y);
  y += 4;
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.setFont("helvetica", "normal");
  doc.text("$" + fmt(d.pmTotalNetIncome * 12) + " annually", ML + 3, y);
  y += 6;

  // ═══════════════════════════════════════════════════
  // WHAT'S INCLUDED — 2 columns
  // ═══════════════════════════════════════════════════
  sectionHeader("What's Included");

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

  const midX = ML + CW / 2;
  doc.setFontSize(7.5);
  for (let i = 0; i < features.length; i += 2) {
    ensureSpace(5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PURPLE);
    doc.text("-", ML + 3, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text(features[i], ML + 7, y);
    if (i + 1 < features.length) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...PURPLE);
      doc.text("-", midX + 2, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      doc.text(features[i + 1], midX + 6, y);
    }
    y += 4;
  }
  y += 4;

  // ═══════════════════════════════════════════════════
  // TIER PROGRESSION TABLE
  // ═══════════════════════════════════════════════════
  sectionHeader("As You Grow, You Earn More");

  // Header row
  doc.setFillColor(248, 248, 252);
  doc.rect(ML, y, CW, 5, "F");
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...GRAY);
  const tc = [ML + 3, ML + 28, ML + 58, ML + 95, ML + 135];
  doc.text("Tier", tc[0], y + 3.5);
  doc.text("Units", tc[1], y + 3.5);
  doc.text("Software/Unit", tc[2], y + 3.5);
  doc.text("Card Earnings", tc[3], y + 3.5);
  doc.text("ACH Platform Cost", tc[4], y + 3.5);
  y += 6;

  const tiers = [
    ["Starter", "0-99", "$3.00", "--", "$6.00 (locked)"],
    ["Growth", "100-499", "$2.50", "0.25%", "$4.00"],
    ["Scale", "500-999", "$2.00", "0.30%", "$3.00"],
    ["Enterprise", "1,000+", "$1.50", "0.35%", "$2.00"],
  ];

  doc.setFontSize(7.5);
  for (const t of tiers) {
    const isCurrent = t[0] === d.tierName;
    if (isCurrent) {
      doc.setFillColor(245, 243, 255);
      doc.rect(ML, y - 1.5, CW, 5.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...PURPLE);
    } else {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
    }
    doc.text(t[0], tc[0], y + 2);
    doc.text(t[1], tc[1], y + 2);
    doc.text(t[2], tc[2], y + 2);
    doc.text(t[3], tc[3], y + 2);
    doc.text(t[4], tc[4], y + 2);
    y += 5.5;
  }

  // ═══════════════════════════════════════════════════
  // FOOTER — on every page
  // ═══════════════════════════════════════════════════
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    const fy = PH - 8;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(ML, fy - 3, MR, fy - 3);
    doc.setFontSize(6);
    doc.setTextColor(180, 180, 180);
    doc.text(
      "DoorStax  |  doorstax.com  |  Quote #" +
        d.quoteId +
        "  |  Page " +
        p +
        " of " +
        pages,
      PW / 2,
      fy,
      { align: "center" }
    );
  }

  return Buffer.from(doc.output("arraybuffer"));
}

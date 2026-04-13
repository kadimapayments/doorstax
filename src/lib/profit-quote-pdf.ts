/**
 * DoorStax Pricing Proposal PDF — NEPQ-optimized, branded.
 *
 * Purple header bar + agent credentials sub-bar + branded footer.
 * NEPQ persuasion framing throughout: "Revenue You're Currently
 * Missing", "Your Platform Investment", always-positive verdict box.
 */

import jsPDF from "jspdf";

// Brand colors
const PURPLE: [number, number, number] = [108, 92, 231];
const DARK: [number, number, number] = [30, 30, 30];
const GRAY: [number, number, number] = [120, 120, 120];
const LGRAY: [number, number, number] = [180, 180, 180];
const GREEN: [number, number, number] = [16, 185, 129];
const WHITE: [number, number, number] = [255, 255, 255];
const BG: [number, number, number] = [248, 247, 255];

// Layout (mm)
const ML = 14;
const MR = 196;
const CW = MR - ML;
const LH = 6;
const SG = 14;
const PB = 268;

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
  agentEmail?: string;
  agentId?: string;
  agentPhone?: string;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export async function generateProfitQuotePdf(
  d: QuotePdfData
): Promise<Buffer> {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  let y = 0;

  // ── HELPERS ─────────────────────────────────────────

  function checkPage(needed: number = 30) {
    if (y > PB - needed) {
      addFooter();
      doc.addPage();
      y = addHeader();
    }
  }

  function addHeader(): number {
    // Purple bar
    doc.setFillColor(...PURPLE);
    doc.rect(0, 0, 216, 18, "F");
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...WHITE);
    doc.text("DoorStax", ML, 12);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Pricing Proposal", MR, 12, { align: "right" });

    // Agent sub-bar
    doc.setFillColor(245, 245, 248);
    doc.rect(0, 18, 216, 10, "F");
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    let agentLine = "Prepared by: " + d.preparedBy;
    if (d.agentId) agentLine += "  |  Agent ID: " + d.agentId;
    if (d.agentEmail) agentLine += "  |  " + d.agentEmail;
    if (d.agentPhone) agentLine += "  |  " + d.agentPhone;
    doc.text(agentLine, ML, 24);
    doc.text("Quote #" + d.quoteId, MR, 24, { align: "right" });

    return 34;
  }

  function addFooter() {
    doc.setDrawColor(...PURPLE);
    doc.setLineWidth(0.5);
    doc.line(ML, 273, MR, 273);
    doc.setFontSize(7);
    doc.setTextColor(...LGRAY);
    doc.text(
      "DoorStax  ·  doorstax.com  ·  Powered by Kadima Payments",
      ML,
      277
    );
    doc.text(
      "Quote #" + d.quoteId + "  ·  Page " + doc.getNumberOfPages(),
      MR,
      277,
      { align: "right" }
    );
    doc.setFontSize(6);
    doc.text(
      "This proposal is a personalized estimate. Actual results depend on payment volume and tenant adoption.",
      108,
      281,
      { align: "center" }
    );
  }

  function section(title: string) {
    checkPage(40);
    y += SG;
    doc.setFillColor(...PURPLE);
    doc.rect(ML, y - 3, 3, 10, "F");
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text(title, ML + 7, y + 4);
    y += 12;
  }

  function card(
    x: number,
    w: number,
    label: string,
    value: string,
    color?: [number, number, number]
  ) {
    doc.setFillColor(...BG);
    doc.setDrawColor(230, 228, 240);
    doc.roundedRect(x, y, w, 24, 2, 2, "FD");
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY);
    doc.text(label, x + 4, y + 8);
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...(color || DARK));
    doc.text(value, x + 4, y + 19);
  }

  function row(
    label: string,
    value: string,
    opts?: { color?: [number, number, number]; bold?: boolean }
  ) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY);
    doc.text(label, ML + 4, y);
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.setTextColor(...(opts?.color || DARK));
    doc.text(value, MR - 4, y, { align: "right" });
    y += LH;
  }

  // ── PAGE 1 ──────────────────────────────────────────

  y = addHeader();

  // Prepared for
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text("PREPARED FOR", ML, y);
  y += 5;
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text(d.prospectName, ML, y);
  if (d.prospectCompany) {
    y += 6;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY);
    doc.text(d.prospectCompany, ML, y);
  }
  y += 4;

  // Dates right-aligned
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(
    d.preparedDate.toLocaleDateString("en-US", { dateStyle: "long" }),
    MR,
    y - 8,
    { align: "right" }
  );
  doc.text(
    "Valid until " +
      d.validUntil.toLocaleDateString("en-US", { dateStyle: "long" }),
    MR,
    y - 3,
    { align: "right" }
  );

  // Accent line
  y += 4;
  doc.setDrawColor(...PURPLE);
  doc.setLineWidth(0.8);
  doc.line(ML, y, MR, y);
  y += 8;

  // NEPQ opening — situational awareness
  doc.setFontSize(10);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(...GRAY);
  doc.text(
    "Based on your portfolio of " +
      d.units.toLocaleString() +
      " units at $" +
      d.avgRent.toLocaleString() +
      "/mo average rent",
    ML,
    y
  );
  y += 5;
  doc.text(
    "with " +
      d.occupancyPct +
      "% occupancy — here is what DoorStax can do for you.",
    ML,
    y
  );
  y += SG;

  // Portfolio cards
  const cw3 = (CW - 8) / 3;
  card(ML, cw3, "Units Under Management", d.units.toLocaleString());
  card(
    ML + cw3 + 4,
    cw3,
    "Average Monthly Rent",
    "$" + d.avgRent.toLocaleString()
  );
  card(
    ML + (cw3 + 4) * 2,
    cw3,
    "Estimated Occupancy",
    d.occupancyPct + "%"
  );
  y += 28;

  // Tier
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PURPLE);
  doc.text(
    d.tierName + " Tier  |  $" + d.perUnitCost.toFixed(2) + "/unit",
    ML,
    y
  );
  y += 4;

  // ═══ YOUR PLATFORM INVESTMENT ═══
  section("Your Platform Investment");

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  doc.text(
    "Everything below — tenant portal, accounting, payments, screening, reports — for:",
    ML + 4,
    y
  );
  y += 8;

  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  const costStr = "$" + fmt(d.softwareCost);
  doc.text(costStr, ML + 4, y);
  const costW = doc.getTextWidth(costStr);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  doc.text("/month", ML + 4 + costW + 2, y);
  y += 6;

  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(
    d.units.toLocaleString() +
      " units x $" +
      d.perUnitCost.toFixed(2) +
      "/unit — " +
      d.tierName +
      " tier graduated pricing",
    ML + 4,
    y
  );
  y += 3;
  doc.text(
    "That's $" +
      (d.softwareCost / d.units).toFixed(2) +
      " per unit per month — less than a cup of coffee per door.",
    ML + 4,
    y
  );
  y += SG;

  // ═══ REVENUE YOU'RE CURRENTLY MISSING ═══
  section("Revenue You're Currently Missing");

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  doc.text(
    "Every month without DoorStax, your portfolio generates payment processing revenue that goes uncaptured:",
    ML + 4,
    y
  );
  y += 8;

  card(ML, cw3, "Card Processing Revenue", "+$" + fmt(d.pmCardEarnings), GREEN);
  card(
    ML + cw3 + 4,
    cw3,
    "ACH Processing Revenue",
    "+$" + fmt(d.pmAchEarnings),
    GREEN
  );
  card(
    ML + (cw3 + 4) * 2,
    cw3,
    "Total Monthly Revenue",
    "+$" + fmt(d.totalPmPaymentEarnings),
    GREEN
  );
  y += 28;

  // ═══ VERDICT BOX ═══
  y += 2;
  if (d.pmPaymentsCoverSoftware) {
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(34, 197, 94);
    doc.setLineWidth(1.5);
    doc.roundedRect(ML, y, CW, 28, 3, 3, "FD");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text(
      "The platform pays for itself — and then some.",
      ML + 6,
      y + 9
    );
    doc.setFontSize(20);
    doc.setTextColor(...GREEN);
    doc.text(
      "+$" + fmt(d.pmNetCostOrProfit) + "/month net positive",
      ML + 6,
      y + 22
    );
  } else {
    doc.setFillColor(...BG);
    doc.setDrawColor(...PURPLE);
    doc.setLineWidth(1.5);
    doc.roundedRect(ML, y, CW, 32, 3, 3, "FD");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text(
      "Your actual platform cost after payment revenue:",
      ML + 6,
      y + 9
    );
    doc.setFontSize(20);
    doc.setTextColor(...PURPLE);
    const actual = Math.abs(d.pmNetCostOrProfit);
    doc.text("$" + fmt(actual) + "/month", ML + 6, y + 20);
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    const pct = Math.round(
      (d.totalPmPaymentEarnings / d.softwareCost) * 100
    );
    doc.text(
      "That's only $" +
        (actual / d.units).toFixed(2) +
        " per unit — payment earnings offset " +
        pct +
        "% of the platform cost.",
      ML + 6,
      y + 27
    );
    y += 4;
  }
  y += 32;

  // ═══ UNTAPPED PAYMENT VOLUME ═══
  section("Your Untapped Payment Volume");

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  doc.text(
    "Based on " +
      d.units.toLocaleString() +
      " units at $" +
      d.avgRent.toLocaleString() +
      "/mo with " +
      d.occupancyPct +
      "% occupancy:",
    ML + 4,
    y
  );
  y += 8;

  const occ = Math.round(d.units * (d.occupancyPct / 100));
  const rentVol = occ * d.avgRent;
  const cardVol =
    Math.round(occ * (d.cardPct / 100)) * d.avgRent;
  const achCt = Math.round(occ * ((100 - d.cardPct) / 100));

  row("Monthly rent collected", "$" + fmt(rentVol));
  row("Card volume (" + d.cardPct + "%)", "$" + fmt(cardVol));
  row(
    "ACH transactions (" + (100 - d.cardPct) + "%)",
    achCt.toLocaleString() + " tx/month"
  );
  y += 4;

  // Green callout
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(1);
  doc.roundedRect(ML, y, CW, 18, 3, 3, "FD");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text(
    "Payment revenue you're currently not capturing:",
    ML + 6,
    y + 8
  );
  doc.setFontSize(14);
  doc.setTextColor(...GREEN);
  doc.text(
    "+$" + fmt(d.totalPmPaymentEarnings) + "/month",
    ML + 6,
    y + 15
  );
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(
    "$" + fmt(d.totalPmPaymentEarnings * 12) + "/year",
    ML + CW / 2 + 20,
    y + 15
  );
  y += 22;

  addFooter();

  // ── PAGE 2 ──────────────────────────────────────────
  doc.addPage();
  y = addHeader();

  // Features
  section("Everything Included in DoorStax");

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...DARK);
  const features = [
    ["Property management dashboard", "Online rent payments (card + ACH)"],
    ["Custom applications + e-signatures", "Tenant screening via RentSpree"],
    ["Double-entry accounting engine", "Owner statements + auto payouts"],
    ["Expense tracking + tenant invoicing", "Maintenance ticket system"],
    ["Parking management + split billing", "Team management + role permissions"],
    ["31 branded email templates", "24/7 payment processing via Kadima"],
    ["Lease tracking + renewal alerts", "Document storage + W-9 management"],
    ["Eviction tracking + timeline", "Multi-property + multi-owner support"],
  ];
  for (const [l, r] of features) {
    doc.setTextColor(...PURPLE);
    doc.text("-", ML + 2, y);
    doc.setTextColor(...DARK);
    doc.text(l, ML + 8, y);
    doc.setTextColor(...PURPLE);
    doc.text("-", ML + CW / 2 + 2, y);
    doc.setTextColor(...DARK);
    doc.text(r, ML + CW / 2 + 8, y);
    y += 5.5;
  }
  y += SG;

  // Tier table
  section("As You Grow, You Earn More");

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  doc.text(
    "DoorStax rewards growth. As your portfolio expands, your costs decrease and your earnings increase.",
    ML + 4,
    y
  );
  y += 8;

  const cols = [ML + 2, ML + 40, ML + 78, ML + 116, ML + 150];
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PURPLE);
  doc.text("Tier", cols[0], y);
  doc.text("Units", cols[1], y);
  doc.text("Software/Unit", cols[2], y);
  doc.text("Card Earnings", cols[3], y);
  doc.text("ACH Cost", cols[4], y);
  y += 3;
  doc.setDrawColor(220, 220, 230);
  doc.setLineWidth(0.3);
  doc.line(ML, y, MR, y);
  y += 5;

  const tiers = [
    ["Starter", "0-99", "$3.00", "--", "$6.00 (locked)"],
    ["Growth", "100-499", "$2.50", "0.25%", "$4.00"],
    ["Scale", "500-999", "$2.00", "0.30%", "$3.00"],
    ["Enterprise", "1,000+", "$1.50", "0.35%", "$2.00"],
  ];
  for (const t of tiers) {
    const cur = t[0] === d.tierName;
    if (cur) {
      doc.setFillColor(...BG);
      doc.roundedRect(ML, y - 4, CW, 8, 1, 1, "F");
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...PURPLE);
    } else {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
    }
    doc.setFontSize(9);
    doc.text(t[0], cols[0], y);
    doc.text(t[1], cols[1], y);
    doc.text(t[2], cols[2], y);
    doc.text(t[3], cols[3], y);
    doc.text(t[4], cols[4], y);
    y += 8;
  }
  y += SG;

  // CTA
  section("Ready to Get Started?");

  doc.setFillColor(...BG);
  doc.setDrawColor(...PURPLE);
  doc.setLineWidth(1);
  doc.roundedRect(ML, y, CW, 36, 4, 4, "FD");

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PURPLE);
  doc.text("Start your 14-day free trial", ML + CW / 2, y + 10, {
    align: "center",
  });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  doc.text(
    "No credit card required. Full access to all features.",
    ML + CW / 2,
    y + 18,
    { align: "center" }
  );
  doc.text(
    "Sign up at doorstax.com or contact your DoorStax representative.",
    ML + CW / 2,
    y + 24,
    { align: "center" }
  );

  if (d.agentEmail || d.agentPhone) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    let contact = d.preparedBy;
    if (d.agentId) contact += "  |  " + d.agentId;
    if (d.agentEmail) contact += "  |  " + d.agentEmail;
    if (d.agentPhone) contact += "  |  " + d.agentPhone;
    doc.text(contact, ML + CW / 2, y + 31, { align: "center" });
  }

  addFooter();

  return Buffer.from(doc.output("arraybuffer"));
}

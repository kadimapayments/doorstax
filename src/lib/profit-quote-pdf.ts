/**
 * Branded DoorStax pricing proposal PDF for SDR sales calls.
 */
import jsPDF from "jspdf";

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
  const M = 50;
  let y = 50;

  // Header
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(91, 0, 255);
  doc.text("DoorStax", M, y);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(130, 130, 130);
  doc.text(`Quote #${d.quoteId}`, W - M, y, { align: "right" });
  doc.text(
    `Prepared: ${d.preparedDate.toLocaleDateString("en-US", { dateStyle: "long" })}`,
    W - M,
    y + 12,
    { align: "right" }
  );
  doc.text(
    `Valid until: ${d.validUntil.toLocaleDateString("en-US", { dateStyle: "long" })}`,
    W - M,
    y + 24,
    { align: "right" }
  );
  y += 40;

  // Line
  doc.setDrawColor(91, 0, 255);
  doc.setLineWidth(0.8);
  doc.line(M, y, W - M, y);
  y += 15;

  // Title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("Pricing Proposal", M, y);
  y += 14;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Prepared for: ${d.prospectName}${d.prospectCompany ? " — " + d.prospectCompany : ""}`,
    M,
    y
  );
  y += 12;
  doc.setTextColor(130, 130, 130);
  doc.text(`Prepared by: ${d.preparedBy}`, M, y);
  y += 20;

  // Portfolio
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(91, 0, 255);
  doc.text("Your Portfolio", M, y);
  y += 14;
  doc.setFontSize(10);
  const rows = [
    ["Units", String(d.units)],
    ["Average Rent", `$${d.avgRent.toLocaleString()}`],
    ["Occupancy", `${d.occupancyPct}%`],
    ["Tier", d.tierName],
    ["Management Fee", `${d.mgmtFeePct}%`],
  ];
  for (const [l, v] of rows) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(130, 130, 130);
    doc.text(l, M, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text(v, M + 160, y);
    y += 14;
  }
  y += 10;

  // Investment
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(91, 0, 255);
  doc.text("Your Investment", M, y);
  y += 14;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  doc.text("DoorStax Platform:", M, y);
  doc.setFont("helvetica", "bold");
  doc.text(
    `$${d.softwareCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}/month`,
    M + 160,
    y
  );
  y += 12;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(130, 130, 130);
  doc.text(`(${d.units} units × $${d.perUnitCost.toFixed(2)}/unit)`, M, y);
  y += 20;

  // Earnings
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(91, 0, 255);
  doc.text("Your Potential Earnings", M, y);
  y += 14;
  doc.setFontSize(10);
  const earns = [
    ["Card Processing", `+$${d.pmCardEarnings.toFixed(2)}/mo`],
    ["ACH Processing", `+$${d.pmAchEarnings.toFixed(2)}/mo`],
    ["Total Payment Earnings", `+$${d.totalPmPaymentEarnings.toFixed(2)}/mo`],
  ];
  for (const [l, v] of earns) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(130, 130, 130);
    doc.text(l, M, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(16, 185, 129);
    doc.text(v, M + 200, y);
    y += 14;
  }
  y += 10;

  // Bottom line
  const boxC = d.pmPaymentsCoverSoftware ? [240, 253, 244] : [254, 242, 242];
  const borderC = d.pmPaymentsCoverSoftware ? [34, 197, 94] : [239, 68, 68];
  doc.setFillColor(boxC[0], boxC[1], boxC[2]);
  doc.setDrawColor(borderC[0], borderC[1], borderC[2]);
  doc.roundedRect(M, y, W - M * 2, 40, 4, 4, "FD");
  y += 14;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(
    d.pmPaymentsCoverSoftware
      ? "Payment earnings MORE than cover your software cost!"
      : "Your net cost after payment earnings:",
    M + 10,
    y
  );
  y += 16;
  doc.setFontSize(16);
  doc.setTextColor(
    d.pmNetCostOrProfit >= 0 ? 16 : 239,
    d.pmNetCostOrProfit >= 0 ? 185 : 68,
    d.pmNetCostOrProfit >= 0 ? 129 : 68
  );
  doc.text(
    `${d.pmNetCostOrProfit >= 0 ? "+" : ""}$${d.pmNetCostOrProfit.toFixed(2)}/month`,
    M + 10,
    y
  );
  y += 25;

  // Total income
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(91, 0, 255);
  doc.text("Your Total Monthly Income with DoorStax", M, y);
  y += 14;
  doc.setFontSize(10);
  const income = [
    ["Management Fees", `$${d.mgmtFeeEarnings.toFixed(2)}`],
    ["Payment Earnings", `+$${d.totalPmPaymentEarnings.toFixed(2)}`],
    ["Software Cost", `-$${d.softwareCost.toFixed(2)}`],
  ];
  for (const [l, v] of income) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(130, 130, 130);
    doc.text(l, M, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text(v, W - M, y, { align: "right" });
    y += 14;
  }
  doc.setDrawColor(91, 0, 255);
  doc.line(M, y, W - M, y);
  y += 14;
  doc.setFontSize(14);
  doc.setTextColor(16, 185, 129);
  doc.text(
    `Net Monthly Income: $${d.pmTotalNetIncome.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    M,
    y
  );
  y += 12;
  doc.setFontSize(10);
  doc.setTextColor(130, 130, 130);
  doc.text(
    `$${(d.pmTotalNetIncome * 12).toLocaleString("en-US", { minimumFractionDigits: 2 })} annually`,
    M,
    y
  );

  // Footer
  const fY = doc.internal.pageSize.getHeight() - 30;
  doc.setFontSize(7);
  doc.setTextColor(180, 180, 180);
  doc.text(
    `DoorStax · doorstax.com · Quote #${d.quoteId} · Estimate based on parameters provided`,
    W / 2,
    fY,
    { align: "center" }
  );

  return Buffer.from(doc.output("arraybuffer"));
}

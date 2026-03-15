import { NextResponse } from "next/server";
import { resolveApiSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  addBrandingHeader,
  addAccentLine,
  addFooter,
  formatMoney,
  hexToRgb,
} from "@/lib/pdf-utils";
import { uploadStatementPdf } from "@/lib/blob-storage";

export async function GET(req: Request) {
  const session = await resolveApiSession();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);

  const { searchParams } = new URL(req.url);
  const ownerId = searchParams.get("ownerId");
  const year = parseInt(searchParams.get("year") || "", 10);

  if (!ownerId || isNaN(year)) {
    return NextResponse.json(
      { error: "ownerId and year are required" },
      { status: 400 }
    );
  }

  // Fetch owner
  const owner = await db.owner.findFirst({
    where: { id: ownerId, landlordId },
    include: {
      properties: { select: { name: true } },
    },
  });

  if (!owner) {
    return NextResponse.json({ error: "Owner not found" }, { status: 404 });
  }

  // Fetch payouts for the year
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);

  const payouts = await db.ownerPayout.findMany({
    where: {
      ownerId,
      landlordId,
      status: "PAID",
      periodStart: { gte: yearStart },
      periodEnd: { lt: yearEnd },
    },
    orderBy: { periodStart: "asc" },
  });

  const totalGrossRent = payouts.reduce((s, p) => s + Number(p.grossRent), 0);
  const totalFees = payouts.reduce(
    (s, p) =>
      s +
      Number(p.processingFees) +
      Number(p.managementFee) +
      Number(p.expenses) +
      Number(p.platformFee) +
      Number(p.payoutFee) +
      Number(p.unitFee),
    0
  );
  const totalNetPayout = payouts.reduce((s, p) => s + Number(p.netPayout), 0);

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

  // ── Generate PDF ──
  const doc = new jsPDF();

  let y = await addBrandingHeader(doc, `1099-NEC Summary — ${year}`, {
    companyLogo: landlordUser?.companyLogo,
    companyName: landlordUser?.companyName,
    primaryColor,
  });

  y = addAccentLine(doc, y, primaryColor);

  // Payer info
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text("Payer Information", 14, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  y += 6;

  doc.setFontSize(10);
  const payerInfo: [string, string][] = [
    ["Company", landlordUser?.companyName || "—"],
    ["Tax Year", String(year)],
    ["Form Type", "1099-NEC (Nonemployee Compensation)"],
  ];
  for (const [label, value] of payerInfo) {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, 60, y);
    y += 6;
  }
  y += 4;

  // Recipient info
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text("Recipient Information", 14, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  y += 6;

  doc.setFontSize(10);
  const recipientInfo: [string, string][] = [
    ["Name", owner.name],
    ["Email", owner.email || "—"],
    ["TIN", owner.taxId ? `***-**-${owner.taxId.slice(-4)}` : "Not provided"],
    [
      "Properties",
      owner.properties.map((p) => p.name).join(", ") || "—",
    ],
  ];
  for (const [label, value] of recipientInfo) {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, 60, y);
    y += 6;
  }
  y += 6;

  // 1099-NEC Box Summary
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text("1099-NEC Summary", 14, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  y += 4;

  autoTable(doc, {
    startY: y,
    body: [
      [
        { content: "Box 1 — Nonemployee Compensation", styles: { fontStyle: "bold" as const } },
        { content: formatMoney(totalNetPayout), styles: { fontStyle: "bold" as const, textColor: [pr, pg, pb] } },
      ],
    ],
    theme: "plain",
    styles: { fontSize: 12 },
    columnStyles: {
      0: { cellWidth: 120 },
      1: { halign: "right" as const },
    },
    margin: { left: 14, right: 14 },
  });

  y =
    (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 8;

  // Monthly breakdown
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text("Monthly Breakdown", 14, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [["Period", "Gross Rent", "Fees", "Net Payout"]],
    body: payouts.map((p) => {
      const monthName = new Date(p.periodStart).toLocaleString("en-US", {
        month: "long",
        year: "numeric",
      });
      const fees =
        Number(p.processingFees) +
        Number(p.managementFee) +
        Number(p.expenses) +
        Number(p.platformFee) +
        Number(p.payoutFee) +
        Number(p.unitFee);
      return [
        monthName,
        formatMoney(Number(p.grossRent)),
        `-${formatMoney(fees)}`,
        formatMoney(Number(p.netPayout)),
      ];
    }),
    foot: [
      [
        { content: "Total", styles: { fontStyle: "bold" as const } },
        { content: formatMoney(totalGrossRent), styles: { fontStyle: "bold" as const } },
        { content: `-${formatMoney(totalFees)}`, styles: { fontStyle: "bold" as const } },
        {
          content: formatMoney(totalNetPayout),
          styles: { fontStyle: "bold" as const, textColor: [pr, pg, pb] },
        },
      ],
    ],
    headStyles: {
      fillColor: [pr, pg, pb],
      textColor: 255,
      fontStyle: "bold",
    },
    styles: { fontSize: 9 },
    columnStyles: {
      1: { halign: "right" as const },
      2: { halign: "right" as const },
      3: { halign: "right" as const },
    },
    margin: { left: 14, right: 14 },
  });

  y =
    (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 8;

  // Disclaimer
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  const disclaimer =
    "This is an informational summary for recordkeeping purposes. For official IRS filing, consult your tax professional. " +
    "The amounts shown reflect payments processed through the DoorStax Payment Network during the specified tax year.";
  const splitDisclaimer = doc.splitTextToSize(
    disclaimer,
    doc.internal.pageSize.getWidth() - 28
  );
  doc.text(splitDisclaimer, 14, y);
  doc.setTextColor(0, 0, 0);

  addFooter(doc, { footerText: docSettings?.footerText || undefined });

  const buffer = Buffer.from(doc.output("arraybuffer"));

  // Store as TAX_DOC
  const url = await uploadStatementPdf(buffer, owner.name, `tax-${year}`);

  // Delete any existing 1099 for this owner/year and create new
  await db.ownerDocument.deleteMany({
    where: { ownerId, type: "TAX_DOC", period: String(year) },
  });

  await db.ownerDocument.create({
    data: {
      ownerId,
      name: `1099-NEC Summary — ${year}`,
      url,
      type: "TAX_DOC",
      period: String(year),
    },
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="1099-NEC-${owner.name.replace(/\s+/g, "-")}-${year}.pdf"`,
    },
  });
}

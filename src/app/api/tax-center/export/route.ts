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
import Papa from "papaparse";

export async function GET(req: Request) {
  const session = await resolveApiSession();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()), 10);
  const format = searchParams.get("format") || "csv";

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);

  // Get owners with payouts
  const owners = await db.owner.findMany({
    where: { landlordId },
    include: {
      payouts: {
        where: {
          periodStart: { gte: yearStart },
          periodEnd: { lt: yearEnd },
          status: "PAID",
        },
        select: {
          grossRent: true,
          processingFees: true,
          managementFee: true,
          expenses: true,
          platformFee: true,
          payoutFee: true,
          unitFee: true,
          netPayout: true,
        },
      },
    },
  });

  const rows = owners.map((owner) => {
    const totalGross = owner.payouts.reduce((s, p) => s + Number(p.grossRent), 0);
    const totalFees = owner.payouts.reduce(
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
    const totalNet = owner.payouts.reduce((s, p) => s + Number(p.netPayout), 0);

    return {
      name: owner.name,
      email: owner.email || "",
      taxIdStatus: owner.taxId ? "On file" : "Missing",
      totalGrossRent: Math.round(totalGross * 100) / 100,
      totalFees: Math.round(totalFees * 100) / 100,
      totalNetPayout: Math.round(totalNet * 100) / 100,
      payoutCount: owner.payouts.length,
      requires1099: totalNet >= 600 ? "Yes" : "No",
    };
  });

  if (format === "csv") {
    const csv = Papa.unparse(
      rows.map((r) => ({
        "Owner Name": r.name,
        Email: r.email,
        "TIN Status": r.taxIdStatus,
        "Total Gross Rent": r.totalGrossRent,
        "Total Fees": r.totalFees,
        "Net Disbursements": r.totalNetPayout,
        "Payout Count": r.payoutCount,
        "1099 Required": r.requires1099,
      }))
    );

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="tax-summary-${year}.csv"`,
      },
    });
  }

  // PDF format
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

  const doc = new jsPDF({ orientation: "landscape" });

  let y = await addBrandingHeader(doc, `Annual Tax Summary — ${year}`, {
    companyLogo: landlordUser?.companyLogo,
    companyName: landlordUser?.companyName,
    primaryColor,
  });

  y = addAccentLine(doc, y, primaryColor);

  // Summary
  doc.setFontSize(10);
  const totalDisbursements = rows.reduce((s, r) => s + r.totalNetPayout, 0);
  const above600 = rows.filter((r) => r.totalNetPayout >= 600).length;
  doc.text(
    `Total Disbursements: ${formatMoney(totalDisbursements)}   |   Owners: ${rows.length}   |   1099 Required: ${above600}`,
    14,
    y
  );
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [["Owner", "Email", "TIN", "Gross Rent", "Fees", "Net Payout", "Payouts", "1099"]],
    body: rows.map((r) => [
      r.name,
      r.email,
      r.taxIdStatus,
      formatMoney(r.totalGrossRent),
      formatMoney(r.totalFees),
      formatMoney(r.totalNetPayout),
      String(r.payoutCount),
      r.requires1099,
    ]),
    headStyles: {
      fillColor: [pr, pg, pb],
      textColor: 255,
      fontStyle: "bold",
    },
    styles: { fontSize: 8 },
    columnStyles: {
      3: { halign: "right" as const },
      4: { halign: "right" as const },
      5: { halign: "right" as const },
      6: { halign: "center" as const },
      7: { halign: "center" as const },
    },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc, { footerText: docSettings?.footerText || undefined });

  const buffer = Buffer.from(doc.output("arraybuffer"));
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="tax-summary-${year}.pdf"`,
    },
  });
}

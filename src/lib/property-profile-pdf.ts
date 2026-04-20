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
} from "@/lib/pdf-utils";

/**
 * Generate the DoorStax underwriter Property Profile PDF.
 *
 * Produced from the data captured in /dashboard/properties/new (the 6-step
 * wizard). Intended audience: Kadima's risk / underwriting team deciding
 * whether to approve the implicit volume-increase + terminal request that
 * every new property represents.
 *
 * Always DoorStax-branded (not PM-branded) — underwriters want every
 * building profile to look the same regardless of which PM submitted it.
 */

const BRAND_PURPLE = "#5B00FF";
const BRAND_NAVY = "#23297D";
const AMBER = "#D97706";
const EMERALD = "#059669";
const RED = "#DC2626";

function fmtYesNo(v: boolean | null | undefined): string {
  if (v === true) return "Yes";
  if (v === false) return "No";
  return "—";
}

function fmtNumber(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("en-US");
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtStr(v: string | null | undefined, fallback = "—"): string {
  return v && v.trim() ? v : fallback;
}

function statusColor(status: string): [number, number, number] {
  switch (status) {
    case "APPROVED":
      return hexToRgb(EMERALD);
    case "REJECTED":
      return hexToRgb(RED);
    case "NEEDS_INFO":
      return hexToRgb(AMBER);
    case "PENDING_REVIEW":
    default:
      return hexToRgb(AMBER);
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "PENDING_REVIEW":
      return "Pending Review";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "NEEDS_INFO":
      return "Needs Info";
    default:
      return status;
  }
}

export async function generatePropertyProfilePdf(
  propertyId: string
): Promise<{ buffer: Buffer; filename: string }> {
  // ── Fetch everything in one pass ──
  const property = await db.property.findUnique({
    where: { id: propertyId },
    include: {
      landlord: {
        select: {
          id: true,
          name: true,
          email: true,
          companyName: true,
          phone: true,
        },
      },
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          managementFeePercent: true,
        },
      },
      units: {
        select: {
          id: true,
          unitNumber: true,
          bedrooms: true,
          bathrooms: true,
          sqft: true,
          rentAmount: true,
          status: true,
        },
        orderBy: { unitNumber: "asc" },
      },
      documents: {
        orderBy: { uploadedAt: "desc" },
      },
    },
  });

  if (!property) throw new Error("Property not found");

  // PM's merchant application status (for the underwriter's context)
  const merchantApp = await db.merchantApplication.findUnique({
    where: { userId: property.landlordId },
    select: { status: true, kadimaAppId: true },
  });

  // ── Build the document ──
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const PAGE_W = doc.internal.pageSize.getWidth();
  const MARGIN = 36;

  let y = await addBrandingHeader(doc, "Property Profile — Underwriter Review", {
    primaryColor: BRAND_PURPLE,
  });
  y = addAccentLine(doc, y, BRAND_PURPLE);
  y += 12;

  // ── Summary: two-column layout (property vs PM + status) ──
  const colWidth = (PAGE_W - MARGIN * 2 - 20) / 2;

  // Left column: property identity
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...hexToRgb(BRAND_NAVY));
  doc.text(property.name, MARGIN, y);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  const addressLine = `${property.address}, ${property.city}, ${property.state} ${property.zip}`;
  doc.text(addressLine, MARGIN, y + 16);
  doc.text(`Type: ${property.propertyType}`, MARGIN, y + 32);

  // Right column: PM + review state
  const rightX = MARGIN + colWidth + 20;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...hexToRgb(BRAND_NAVY));
  doc.text("Submitted by", rightX, y);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(
    property.landlord?.companyName || property.landlord?.name || "—",
    rightX,
    y + 14
  );
  if (property.landlord?.email) {
    doc.text(property.landlord.email, rightX, y + 28);
  }
  doc.text(
    `Merchant app: ${merchantApp?.status || "N/A"}`,
    rightX,
    y + 42
  );

  // Status chip
  const chipY = y + 58;
  const chipColor = statusColor(property.boardingStatus);
  doc.setFillColor(...chipColor);
  const chipLabel = statusLabel(property.boardingStatus);
  doc.setFontSize(9);
  const chipW = doc.getTextWidth(chipLabel) + 14;
  doc.roundedRect(rightX, chipY, chipW, 18, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text(chipLabel, rightX + 7, chipY + 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Submitted ${fmtDate(property.submittedForReviewAt)}`,
    rightX + chipW + 8,
    chipY + 12
  );

  y += 96;

  // ── Building profile section ──
  y = drawSectionTitle(doc, y, "Building profile");
  autoTable(doc, {
    startY: y,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 130, textColor: [70, 70, 90] },
      1: { cellWidth: 170 },
      2: { fontStyle: "bold", cellWidth: 130, textColor: [70, 70, 90] },
      3: { cellWidth: 170 },
    },
    body: [
      [
        "Year built",
        fmtNumber(property.yearBuilt),
        "Total sqft",
        fmtNumber(property.totalSqft),
      ],
      [
        "Stories",
        fmtNumber(property.storyCount),
        "Construction",
        fmtStr(property.constructionType),
      ],
      [
        "Elevator",
        fmtYesNo(property.hasElevator),
        "On-site laundry",
        fmtYesNo(property.hasOnsiteLaundry),
      ],
      [
        "Parking spaces",
        fmtNumber(property.parkingSpaces),
        "Parking type",
        fmtStr(property.parkingType),
      ],
    ],
    margin: { left: MARGIN, right: MARGIN },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 16;

  // ── Unit mix ──
  y = checkPageBreak(doc, y, 100);
  y = drawSectionTitle(doc, y, "Unit mix");
  autoTable(doc, {
    startY: y,
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: {
      fillColor: hexToRgb(BRAND_NAVY),
      textColor: [255, 255, 255],
      fontSize: 9,
    },
    head: [["Category", "Count", "Notes"]],
    body: [
      [
        "Residential",
        fmtNumber(property.residentialUnitCount),
        property.units.length > 0
          ? `${property.units.length} unit row(s) on file`
          : "—",
      ],
      [
        "Commercial",
        fmtNumber(property.commercialUnitCount),
        property.commercialFloors
          ? `Floors: ${property.commercialFloors}`
          : "—",
      ],
      [
        "Section 8 / subsidized",
        fmtNumber(property.section8UnitCount),
        (property.section8UnitCount ?? 0) > 0
          ? "Subject to HUD inspection schedule"
          : "—",
      ],
    ],
    margin: { left: MARGIN, right: MARGIN },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 10;

  // Unit detail (if any rows exist)
  if (property.units.length > 0) {
    y = checkPageBreak(doc, y, 100);
    autoTable(doc, {
      startY: y,
      theme: "striped",
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: {
        fillColor: hexToRgb(BRAND_NAVY),
        textColor: [255, 255, 255],
        fontSize: 9,
      },
      head: [["Unit", "Beds", "Baths", "Sqft", "Rent", "Status"]],
      body: property.units.map((u) => [
        u.unitNumber,
        fmtNumber(u.bedrooms),
        u.bathrooms != null ? String(u.bathrooms) : "—",
        fmtNumber(u.sqft),
        u.rentAmount != null ? formatMoney(Number(u.rentAmount)) : "—",
        u.status || "—",
      ]),
      margin: { left: MARGIN, right: MARGIN },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 16;
  } else {
    y += 6;
  }

  // ── Financial ──
  y = checkPageBreak(doc, y, 140);
  y = drawSectionTitle(doc, y, "Financial");
  autoTable(doc, {
    startY: y,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 180, textColor: [70, 70, 90] },
      1: { cellWidth: 340 },
    },
    body: [
      [
        "Purchase price",
        property.purchasePrice
          ? formatMoney(Number(property.purchasePrice))
          : "—",
      ],
      ["Purchase date", fmtDate(property.purchaseDate)],
      [
        "Expected monthly rent roll",
        property.expectedMonthlyRentRoll
          ? formatMoney(Number(property.expectedMonthlyRentRoll))
          : "—",
      ],
      [
        "Annual property tax",
        property.annualPropertyTax
          ? formatMoney(Number(property.annualPropertyTax))
          : "—",
      ],
      ["Mortgage / lien holder", fmtStr(property.mortgageHolder)],
      ["Insurance carrier", fmtStr(property.insuranceCarrier)],
      ["Insurance policy #", fmtStr(property.insurancePolicyNumber)],
      ["Parcel number (APN)", fmtStr(property.parcelNumber)],
      ["Zoning", fmtStr(property.zoning)],
    ],
    margin: { left: MARGIN, right: MARGIN },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 16;

  // ── Owner ──
  y = checkPageBreak(doc, y, 100);
  y = drawSectionTitle(doc, y, "Owner");
  if (property.owner) {
    autoTable(doc, {
      startY: y,
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 180, textColor: [70, 70, 90] },
        1: { cellWidth: 340 },
      },
      body: [
        ["Name", fmtStr(property.owner.name)],
        ["Email", fmtStr(property.owner.email)],
        ["Phone", fmtStr(property.owner.phone)],
        [
          "Management fee",
          property.owner.managementFeePercent != null
            ? `${Number(property.owner.managementFeePercent).toFixed(2)}%`
            : "—",
        ],
      ],
      margin: { left: MARGIN, right: MARGIN },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 16;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text("No owner assigned.", MARGIN, y + 12);
    y += 26;
  }

  // ── Documents ──
  y = checkPageBreak(doc, y, 100);
  y = drawSectionTitle(doc, y, "Documents on file");
  if (property.documents.length > 0) {
    autoTable(doc, {
      startY: y,
      theme: "striped",
      styles: { fontSize: 8.5, cellPadding: 4 },
      headStyles: {
        fillColor: hexToRgb(BRAND_NAVY),
        textColor: [255, 255, 255],
        fontSize: 8.5,
      },
      head: [["Type", "Label", "Filename", "Size", "Uploaded"]],
      body: property.documents.map((d) => [
        d.type,
        d.label || "—",
        d.fileName,
        `${(d.fileSize / (1024 * 1024)).toFixed(2)} MB`,
        fmtDate(d.uploadedAt),
      ]),
      margin: { left: MARGIN, right: MARGIN },
    });
  } else {
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text("No documents uploaded.", MARGIN, y + 12);
  }

  // ── Review notes (if any) ──
  if (property.reviewNotes) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const after = (doc as any).lastAutoTable?.finalY || y + 20;
    y = checkPageBreak(doc, after + 16, 80);
    y = drawSectionTitle(doc, y, "Underwriter notes");
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    const lines = doc.splitTextToSize(property.reviewNotes, PAGE_W - MARGIN * 2);
    doc.text(lines, MARGIN, y + 4);
  }

  addFooter(doc, {
    footerText: "Confidential — DoorStax Underwriting",
    primaryColor: BRAND_PURPLE,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const arrayBuffer = doc.output("arraybuffer") as ArrayBuffer;
  const buffer = Buffer.from(arrayBuffer);

  const safeName = property.name.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  const filename = `${safeName}-underwriter-profile-${new Date()
    .toISOString()
    .slice(0, 10)}.pdf`;

  return { buffer, filename };
}

function drawSectionTitle(doc: jsPDF, y: number, title: string): number {
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...hexToRgb(BRAND_NAVY));
  doc.text(title, 36, y);
  doc.setDrawColor(...hexToRgb(BRAND_PURPLE));
  doc.setLineWidth(0.8);
  doc.line(36, y + 3, 110, y + 3);
  return y + 16;
}

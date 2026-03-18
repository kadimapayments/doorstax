import jsPDF from "jspdf";
import { checkPageBreak, addAccentLine, hexToRgb } from "@/lib/pdf-utils";
import fs from "fs";
import path from "path";

// ─── Types ──────────────────────────────────────────

export interface SignerAuditEntry {
  name: string;
  title: string | null;
  ownershipPercent: number | null;
  signedAt: string; // ISO string
  ip: string;
  userAgent: string;
  signatureBase64: string | null;
}

export interface SignatureAuditData {
  merchantName: string;
  dba: string | null;
  applicationId: string;
  applicationDate: string;
  signers: SignerAuditEntry[];
  agreementPdfHash: string;
  generatedAt: string; // ISO string
}

// ─── Logo helper ────────────────────────────────────

let _logoDataUrl: string | null = null;

function getDoorstaxLogo(): string | null {
  if (_logoDataUrl) return _logoDataUrl;
  try {
    const logoPath = path.join(process.cwd(), "public", "doorstax-logo.png");
    const buf = fs.readFileSync(logoPath);
    _logoDataUrl = `data:image/png;base64,${buf.toString("base64")}`;
    return _logoDataUrl;
  } catch {
    return null;
  }
}

// ─── Generator ──────────────────────────────────────

export async function generateSignatureDetailsPdf(
  data: SignatureAuditData
): Promise<Buffer> {
  const doc = new jsPDF({ format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const primaryColor = "#5B00FF";
  const [pr, pg, pb] = hexToRgb(primaryColor);
  let y = 14;

  // ── Header ──
  const logo = getDoorstaxLogo();
  if (logo) {
    doc.addImage(logo, "PNG", 14, 10, 44, 9);
    y = 24;
  } else {
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(pr, pg, pb);
    doc.text("DoorStax", 14, y + 4);
    doc.setTextColor(0, 0, 0);
    y = 22;
  }

  y += 4;
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Signature Verification & Audit Trail", 14, y);
  y += 4;

  y = addAccentLine(doc, y, primaryColor);

  // ── Application Summary ──
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text("Application Summary", 14, y);
  doc.setFont("helvetica", "normal");
  y += 7;

  const summaryFields: [string, string][] = [
    ["Merchant Legal Name", data.merchantName || "N/A"],
    ["DBA", data.dba || "N/A"],
    ["Application ID", data.applicationId],
    ["Application Date", data.applicationDate],
  ];

  doc.setFontSize(9);
  for (const [label, value] of summaryFields) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(80, 80, 80);
    doc.text(`${label}:`, 14, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(value, 70, y);
    y += 5.5;
  }
  y += 4;

  // ── Signer Details ──
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text("Signer Details", 14, y);
  y += 8;

  for (let i = 0; i < data.signers.length; i++) {
    const signer = data.signers[i];
    y = checkPageBreak(doc, y, 70);

    // Signer header bar
    doc.setFillColor(248, 246, 255);
    doc.roundedRect(14, y, pageWidth - 28, 10, 2, 2, "F");
    doc.setFillColor(pr, pg, pb);
    doc.rect(14, y, 3, 10, "F");

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40, 40, 40);
    doc.text(`Signer ${i + 1}: ${signer.name}`, 22, y + 7);
    y += 14;

    const signerFields: [string, string][] = [
      ["Title", signer.title || "N/A"],
      ["Ownership", signer.ownershipPercent != null ? `${signer.ownershipPercent}%` : "N/A"],
      ["Signed Date/Time (UTC)", signer.signedAt],
      ["IP Address", signer.ip],
      ["User Agent", signer.userAgent.length > 80 ? signer.userAgent.substring(0, 80) + "..." : signer.userAgent],
    ];

    doc.setFontSize(8.5);
    for (const [label, value] of signerFields) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(80, 80, 80);
      doc.text(`${label}:`, 18, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      const valueLines = doc.splitTextToSize(value, pageWidth - 90);
      doc.text(valueLines, 70, y);
      y += 5 * valueLines.length;
    }

    // Signature image
    if (signer.signatureBase64) {
      y += 2;
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(80, 80, 80);
      doc.text("Signature:", 18, y);
      y += 2;

      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.rect(18, y, 80, 25);
      try {
        doc.addImage(signer.signatureBase64, "PNG", 19, y + 1, 78, 23);
      } catch {
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text("[Signature image could not be rendered]", 20, y + 13);
      }
      y += 30;
    }

    y += 6;
  }

  // ── Document Integrity ──
  y = checkPageBreak(doc, y, 40);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text("Document Integrity", 14, y);
  y += 8;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(80, 80, 80);
  doc.text("Agreement PDF SHA-256 Hash:", 14, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text(data.agreementPdfHash, 14, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(80, 80, 80);
  doc.text("Generation Timestamp:", 14, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  doc.text(data.generatedAt, 60, y);
  y += 12;

  // ── Footer Certification ──
  y = checkPageBreak(doc, y, 30);
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(14, y, pageWidth - 14, y);
  y += 6;

  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100, 100, 100);
  const certText =
    "This document certifies the electronic signatures were captured through the DoorStax platform. " +
    "Each signature was collected with the signer's informed consent, and the IP address, timestamp, and " +
    "user agent were recorded at the time of signing. The SHA-256 hash above can be used to verify the " +
    "integrity of the associated agreement PDF.";
  const certLines = doc.splitTextToSize(certText, pageWidth - 28);
  doc.text(certLines, 14, y);
  y += certLines.length * 4 + 8;

  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Generated on ${new Date().toLocaleDateString()} | DoorStax Payment Network`,
    14,
    doc.internal.pageSize.getHeight() - 10
  );

  const buffer = Buffer.from(doc.output("arraybuffer"));
  return buffer;
}

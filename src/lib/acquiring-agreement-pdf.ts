import jsPDF from "jspdf";
import { checkPageBreak, hexToRgb, formatMoney } from "@/lib/pdf-utils";
import fs from "fs";
import path from "path";

// ─── Types ──────────────────────────────────────────

export interface PrincipalData {
  id: string;
  firstName: string;
  lastName: string;
  title: string | null;
  dob: Date | null;
  ssn: string | null;
  driversLicense: string | null;
  driversLicenseExp: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  ownershipPercent: number | null;
  isManager: boolean;
  signatureBase64: string | null;
  signedAt: Date | null;
}

export interface FeeScheduleData {
  interchangePlusRate: number | null;
  qualifiedRate: number | null;
  midQualSurcharge: number | null;
  nonQualSurcharge: number | null;
  rateType: string | null;
  visaMcDiscoverRate: number | null;
  offlineDebitRate: number | null;
  amexOptBlueRate: number | null;
  authorizationFee: number | null;
  transactionFee: number | null;
  monthlyDashboardFee: number | null;
  voiceAuthFee: number | null;
  monthlyMinimumFee: number | null;
  applicationFee: number | null;
  batchFee: number | null;
  chargebackFee: number | null;
  retrievalFee: number | null;
  avsTransactionFee: number | null;
  monthlyFee: number | null;
  annualFee: number | null;
  monthlyPciFee: number | null;
  specialNotes: string | null;
}

export interface AgreementData {
  id: string;
  businessLegalName: string | null;
  dba: string | null;
  businessType: string | null;
  ein: string | null;
  businessAddress: string | null;
  businessCity: string | null;
  businessState: string | null;
  businessZip: string | null;
  businessPhone: string | null;
  businessEmail: string | null;
  websiteUrl: string | null;
  yearsInBusiness: number | null;
  stockSymbol: string | null;
  faxNumber: string | null;
  mccCode: string | null;
  productDescription: string | null;
  numberOfBuildings: number | null;
  numberOfUnits: number | null;
  monthlyVolume: number | null;
  averageTransaction: number | null;
  maxTransactionAmount: number | null;
  amexMonthlyVolume: number | null;
  buildingType: string | null;
  merchantOwnsOrRents: string | null;
  areaZoned: string | null;
  squareFootage: string | null;
  bankruptcyHistory: string | null;
  bankruptcyExplanation: string | null;
  currentlyProcessCards: boolean | null;
  currentProcessor: string | null;
  everTerminated: boolean | null;
  terminatedExplanation: string | null;
  acceptVisa: boolean;
  acceptAmex: boolean;
  acceptPinDebit: boolean;
  acceptEbt: boolean;
  amexOptOut: boolean;
  salesMethodInPerson: number | null;
  salesMethodMailPhone: number | null;
  salesMethodEcommerce: number | null;
  bankRoutingNumber: string | null;
  bankAccountNumber: string | null;
  bankAccountUsage: string | null;
  refundPolicy: string | null;
  equipmentUsed: string | null;
  recurringServices: string | null;
  customerProfileConsumer: number | null;
  customerProfileBusiness: number | null;
  customerProfileGovernment: number | null;
  customerLocationLocal: number | null;
  customerLocationNational: number | null;
  customerLocationInternational: number | null;
  fulfillmentTiming: string | null;
  deliveryTiming: string | null;
  chargedAt: string | null;
  hasRetailLocation: boolean | null;
  retailLocationAddress: string | null;
  advertisingMethods: string | null;
  isSeasonal: boolean | null;
  seasonalMonths: string | null;
  principals: PrincipalData[];
  feeSchedule: FeeScheduleData | null;
}

// ─── Helpers ────────────────────────────────────────

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

const MARGIN_LEFT = 14;
const MARGIN_RIGHT = 14;
const LABEL_FONT = 7.5;
const VALUE_FONT = 8.5;
const SECTION_TITLE_FONT = 10;

function val(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US");
}

function fmtMoney(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  return formatMoney(Number(n));
}

function fmtRate(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  return `${Number(n).toFixed(4)}%`;
}

function fmtFee(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  return `$${Number(n).toFixed(2)}`;
}

function mask(s: string | null): string {
  if (!s || s.length < 4) return s || "";
  return "****" + s.slice(-4);
}

// ─── Drawing Helpers ────────────────────────────────

function drawSectionTitle(doc: jsPDF, title: string, y: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const [pr, pg, pb] = hexToRgb("#5B00FF");

  doc.setFillColor(pr, pg, pb);
  doc.rect(MARGIN_LEFT, y, pageWidth - MARGIN_LEFT - MARGIN_RIGHT, 7, "F");
  doc.setFontSize(SECTION_TITLE_FONT);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(title, MARGIN_LEFT + 3, y + 5);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  return y + 10;
}

function drawField(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number
): number {
  const rowH = 12;
  // Cell border
  doc.setDrawColor(220, 220, 225);
  doc.setLineWidth(0.2);
  doc.rect(x, y - 3, width, rowH);

  // Label
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(130, 130, 130);
  doc.text(label, x + 2, y);

  // Value
  doc.setFontSize(VALUE_FONT);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  const lines = doc.splitTextToSize(value || "N/A", width - 4);
  doc.text(lines[0] || "", x + 2, y + 5);
  return y + rowH - 3;
}

function drawFieldRow(
  doc: jsPDF,
  fields: { label: string; value: string; width: number }[],
  y: number
): number {
  let x = MARGIN_LEFT;
  let maxY = y;
  for (const f of fields) {
    const bottomY = drawField(doc, f.label, f.value, x, y, f.width);
    if (bottomY > maxY) maxY = bottomY;
    x += f.width;
  }
  return maxY + 2;
}

function drawCheckbox(doc: jsPDF, label: string, checked: boolean, x: number, y: number): void {
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(x, y - 3, 3.5, 3.5);
  if (checked) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("X", x + 0.5, y);
    doc.setFont("helvetica", "normal");
  }
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text(label, x + 5, y);
}

function drawSignatureLine(
  doc: jsPDF,
  label: string,
  x: number,
  y: number,
  lineWidth: number,
  signatureBase64?: string | null
): number {
  if (signatureBase64) {
    try {
      doc.addImage(signatureBase64, "PNG", x, y - 12, lineWidth * 0.6, 12);
    } catch {
      // Signature could not be rendered
    }
  }
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(x, y, x + lineWidth, y);
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  doc.text(label, x, y + 4);
  doc.setTextColor(0, 0, 0);
  return y + 8;
}

// ─── Main Generator ─────────────────────────────────

export async function generateAcquiringAgreementPdf(
  data: AgreementData
): Promise<Buffer> {
  const doc = new jsPDF({ format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - MARGIN_LEFT - MARGIN_RIGHT;
  const halfWidth = contentWidth / 2;
  const thirdWidth = contentWidth / 3;

  // ════════════════════════════════════════════════════
  // PAGE 1: Header, Business Info, Contact, Processing, Entity, Location, Principal 1
  // ════════════════════════════════════════════════════

  let y = 10;

  // Logo
  const logo = getDoorstaxLogo();
  if (logo) {
    doc.addImage(logo, "PNG", MARGIN_LEFT, y, 44, 9);
  }

  // Title
  y = 24;
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("MERCHANT ACCOUNT APPLICATION AND AGREEMENT V1.8", pageWidth / 2, y, {
    align: "center",
  });
  y += 5;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("DoorStax Payment Network | Kadima Payments", pageWidth / 2, y, {
    align: "center",
  });
  doc.setTextColor(0, 0, 0);
  y += 6;

  // Thin accent line
  const [pr, pg, pb] = hexToRgb("#5B00FF");
  doc.setDrawColor(pr, pg, pb);
  doc.setLineWidth(1);
  doc.line(MARGIN_LEFT, y, pageWidth - MARGIN_RIGHT, y);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  y += 6;

  // ── Business Information ──
  y = drawSectionTitle(doc, "BUSINESS INFORMATION", y);
  y = drawFieldRow(doc, [
    { label: "Legal Business Name", value: val(data.businessLegalName), width: halfWidth },
    { label: "DBA (Doing Business As)", value: val(data.dba), width: halfWidth },
  ], y);
  y = drawFieldRow(doc, [
    { label: "Business Address", value: val(data.businessAddress), width: contentWidth * 0.4 },
    { label: "City", value: val(data.businessCity), width: contentWidth * 0.3 },
    { label: "State", value: val(data.businessState), width: contentWidth * 0.15 },
    { label: "ZIP", value: val(data.businessZip), width: contentWidth * 0.15 },
  ], y);
  y = drawFieldRow(doc, [
    { label: "Federal Tax ID (EIN)", value: val(data.ein), width: thirdWidth },
    { label: "Years in Business", value: val(data.yearsInBusiness), width: thirdWidth },
    { label: "Stock Symbol", value: val(data.stockSymbol), width: thirdWidth },
  ], y);

  // ── Contact Information ──
  y = drawSectionTitle(doc, "CONTACT INFORMATION", y);
  y = drawFieldRow(doc, [
    { label: "Business Phone", value: val(data.businessPhone), width: thirdWidth },
    { label: "Fax Number", value: val(data.faxNumber), width: thirdWidth },
    { label: "Business Email", value: val(data.businessEmail), width: thirdWidth },
  ], y);
  y = drawFieldRow(doc, [
    { label: "Website URL", value: val(data.websiteUrl), width: halfWidth },
    { label: "MCC Code", value: val(data.mccCode), width: halfWidth / 2 },
  ], y);

  // ── Processing Information ──
  y = drawSectionTitle(doc, "PROCESSING INFORMATION", y);
  y = drawFieldRow(doc, [
    { label: "Monthly Volume", value: fmtMoney(data.monthlyVolume), width: thirdWidth },
    { label: "Average Transaction", value: fmtMoney(data.averageTransaction), width: thirdWidth },
    { label: "Max Transaction", value: fmtMoney(data.maxTransactionAmount), width: thirdWidth },
  ], y);
  y = drawFieldRow(doc, [
    { label: "Amex Monthly Volume", value: fmtMoney(data.amexMonthlyVolume), width: thirdWidth },
    { label: "Number of Buildings", value: val(data.numberOfBuildings), width: thirdWidth },
    { label: "Number of Units", value: val(data.numberOfUnits), width: thirdWidth },
  ], y);
  y = drawFieldRow(doc, [
    { label: "Product/Service Description", value: val(data.productDescription), width: contentWidth },
  ], y);

  // ── Entity Type ──
  y = drawSectionTitle(doc, "ENTITY TYPE", y);
  const entityTypes = [
    "Sole Proprietorship",
    "Partnership",
    "Corporation",
    "LLC",
    "Non-Profit",
    "Government",
    "Tax Exempt",
  ];
  let ex = MARGIN_LEFT;
  for (const et of entityTypes) {
    drawCheckbox(doc, et, data.businessType === et, ex, y + 3);
    ex += 26;
    if (ex > pageWidth - MARGIN_RIGHT - 20) {
      ex = MARGIN_LEFT;
      y += 7;
    }
  }
  y += 10;

  // ── Location ──
  y = checkPageBreak(doc, y, 25);
  y = drawSectionTitle(doc, "LOCATION DETAILS", y);
  y = drawFieldRow(doc, [
    { label: "Building Type", value: val(data.buildingType), width: thirdWidth },
    { label: "Owns or Rents", value: val(data.merchantOwnsOrRents), width: thirdWidth },
    { label: "Area Zoned", value: val(data.areaZoned), width: thirdWidth },
  ], y);
  y = drawFieldRow(doc, [
    { label: "Square Footage", value: val(data.squareFootage), width: halfWidth },
  ], y);

  // Payment Acceptance
  y = checkPageBreak(doc, y, 18);
  y = drawSectionTitle(doc, "PAYMENT ACCEPTANCE", y);
  const cards = [
    { label: "Visa/MC/Discover", checked: data.acceptVisa },
    { label: "American Express", checked: data.acceptAmex },
    { label: "PIN Debit", checked: data.acceptPinDebit },
    { label: "EBT", checked: data.acceptEbt },
    { label: "Amex OptBlue Opt-Out", checked: data.amexOptOut },
  ];
  let cx = MARGIN_LEFT;
  for (const c of cards) {
    drawCheckbox(doc, c.label, c.checked, cx, y + 3);
    cx += 36;
  }
  y += 10;

  // ── Principal 1 ──
  y = checkPageBreak(doc, y, 40);
  y = drawSectionTitle(doc, "PRINCIPAL / OWNER 1", y);
  if (data.principals.length > 0) {
    const p = data.principals[0];
    y = drawFieldRow(doc, [
      { label: "First Name", value: val(p.firstName), width: thirdWidth },
      { label: "Last Name", value: val(p.lastName), width: thirdWidth },
      { label: "Title", value: val(p.title), width: thirdWidth },
    ], y);
    y = drawFieldRow(doc, [
      { label: "Date of Birth", value: fmtDate(p.dob), width: thirdWidth },
      { label: "SSN", value: mask(p.ssn), width: thirdWidth },
      { label: "Ownership %", value: p.ownershipPercent != null ? `${p.ownershipPercent}%` : "", width: thirdWidth },
    ], y);
    y = drawFieldRow(doc, [
      { label: "Driver's License #", value: mask(p.driversLicense), width: thirdWidth },
      { label: "DL Expiration", value: val(p.driversLicenseExp), width: thirdWidth },
      { label: "Email", value: val(p.email), width: thirdWidth },
    ], y);
    y = drawFieldRow(doc, [
      { label: "Address", value: val(p.address), width: halfWidth },
      { label: "City", value: val(p.city), width: thirdWidth / 2 },
    ], y);
    y = drawFieldRow(doc, [
      { label: "State", value: val(p.state), width: thirdWidth / 2 },
      { label: "ZIP", value: val(p.zip), width: thirdWidth / 2 },
      { label: "Phone", value: val(p.phone), width: thirdWidth },
    ], y);
  }

  // ════════════════════════════════════════════════════
  // PAGE 2: Principals 2-4, Controlling Person, General Information
  // ════════════════════════════════════════════════════
  doc.addPage();
  y = 14;

  // Principals 2-4
  for (let i = 1; i < 4; i++) {
    y = checkPageBreak(doc, y, 50);
    y = drawSectionTitle(doc, `PRINCIPAL / OWNER ${i + 1}`, y);
    if (i < data.principals.length) {
      const p = data.principals[i];
      y = drawFieldRow(doc, [
        { label: "First Name", value: val(p.firstName), width: thirdWidth },
        { label: "Last Name", value: val(p.lastName), width: thirdWidth },
        { label: "Title", value: val(p.title), width: thirdWidth },
      ], y);
      y = drawFieldRow(doc, [
        { label: "Date of Birth", value: fmtDate(p.dob), width: thirdWidth },
        { label: "SSN", value: mask(p.ssn), width: thirdWidth },
        { label: "Ownership %", value: p.ownershipPercent != null ? `${p.ownershipPercent}%` : "", width: thirdWidth },
      ], y);
      y = drawFieldRow(doc, [
        { label: "Driver's License #", value: mask(p.driversLicense), width: thirdWidth },
        { label: "DL Expiration", value: val(p.driversLicenseExp), width: thirdWidth },
        { label: "Email", value: val(p.email), width: thirdWidth },
      ], y);
      y = drawFieldRow(doc, [
        { label: "Address", value: val(p.address), width: halfWidth },
        { label: "City/State/ZIP", value: `${val(p.city)}, ${val(p.state)} ${val(p.zip)}`, width: halfWidth },
      ], y);
    } else {
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text("N/A — No additional principal", MARGIN_LEFT + 3, y + 2);
      doc.setTextColor(0, 0, 0);
      y += 8;
    }
    y += 2;
  }

  // ── Controlling Person ──
  y = checkPageBreak(doc, y, 25);
  y = drawSectionTitle(doc, "CONTROLLING PERSON (if different from Principal 1)", y);
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(
    "If the entity is controlled by a person who is not a principal listed above, provide details here.",
    MARGIN_LEFT + 3,
    y + 2
  );
  doc.setTextColor(0, 0, 0);
  y += 6;

  // Find a manager principal if different from owner
  const manager = data.principals.find((p) => p.isManager);
  if (manager) {
    y = drawFieldRow(doc, [
      { label: "Name", value: `${val(manager.firstName)} ${val(manager.lastName)}`, width: halfWidth },
      { label: "Title", value: val(manager.title), width: halfWidth },
    ], y);
  } else {
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("Same as Principal 1", MARGIN_LEFT + 3, y);
    doc.setTextColor(0, 0, 0);
    y += 6;
  }

  // ── General Information ──
  y = checkPageBreak(doc, y, 40);
  y = drawSectionTitle(doc, "GENERAL INFORMATION", y);
  y = drawFieldRow(doc, [
    {
      label: "Has the business ever filed for bankruptcy?",
      value: val(data.bankruptcyHistory),
      width: halfWidth,
    },
    {
      label: "If yes, explain",
      value: val(data.bankruptcyExplanation),
      width: halfWidth,
    },
  ], y);
  y = drawFieldRow(doc, [
    { label: "Currently processing cards?", value: val(data.currentlyProcessCards), width: halfWidth },
    { label: "Current processor", value: val(data.currentProcessor), width: halfWidth },
  ], y);
  y = drawFieldRow(doc, [
    { label: "Ever terminated by a processor?", value: val(data.everTerminated), width: halfWidth },
    { label: "If yes, explain", value: val(data.terminatedExplanation), width: halfWidth },
  ], y);

  // ════════════════════════════════════════════════════
  // PAGE 3: Sales Method, Bank Account Info, Merchant Questionnaire
  // ════════════════════════════════════════════════════
  doc.addPage();
  y = 14;

  // ── Sales Method ──
  y = drawSectionTitle(doc, "SALES METHOD (must total 100%)", y);
  y = drawFieldRow(doc, [
    { label: "In Person / Swiped", value: data.salesMethodInPerson != null ? `${data.salesMethodInPerson}%` : "", width: thirdWidth },
    { label: "Mail / Phone Order", value: data.salesMethodMailPhone != null ? `${data.salesMethodMailPhone}%` : "", width: thirdWidth },
    { label: "E-Commerce / Internet", value: data.salesMethodEcommerce != null ? `${data.salesMethodEcommerce}%` : "", width: thirdWidth },
  ], y);

  // ── Bank Account Information ──
  y = checkPageBreak(doc, y, 25);
  y = drawSectionTitle(doc, "BANK ACCOUNT INFORMATION", y);
  y = drawFieldRow(doc, [
    { label: "Routing Number", value: mask(data.bankRoutingNumber), width: thirdWidth },
    { label: "Account Number", value: mask(data.bankAccountNumber), width: thirdWidth },
    { label: "Account Usage", value: val(data.bankAccountUsage), width: thirdWidth },
  ], y);

  // ── Merchant Questionnaire ──
  y = checkPageBreak(doc, y, 60);
  y = drawSectionTitle(doc, "MERCHANT QUESTIONNAIRE", y);
  y = drawFieldRow(doc, [
    { label: "Refund/Cancellation Policy", value: val(data.refundPolicy), width: halfWidth },
    { label: "Equipment Used", value: val(data.equipmentUsed), width: halfWidth },
  ], y);
  y = drawFieldRow(doc, [
    { label: "Recurring Services Description", value: val(data.recurringServices), width: contentWidth },
  ], y);

  // Customer Profile
  y = checkPageBreak(doc, y, 20);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(60, 60, 60);
  doc.text("Customer Profile (must total 100%):", MARGIN_LEFT, y);
  doc.setFont("helvetica", "normal");
  y += 5;
  y = drawFieldRow(doc, [
    { label: "Consumer", value: data.customerProfileConsumer != null ? `${data.customerProfileConsumer}%` : "", width: thirdWidth },
    { label: "Business", value: data.customerProfileBusiness != null ? `${data.customerProfileBusiness}%` : "", width: thirdWidth },
    { label: "Government", value: data.customerProfileGovernment != null ? `${data.customerProfileGovernment}%` : "", width: thirdWidth },
  ], y);

  // Customer Location
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(60, 60, 60);
  doc.text("Customer Location (must total 100%):", MARGIN_LEFT, y);
  doc.setFont("helvetica", "normal");
  y += 5;
  y = drawFieldRow(doc, [
    { label: "Local", value: data.customerLocationLocal != null ? `${data.customerLocationLocal}%` : "", width: thirdWidth },
    { label: "National", value: data.customerLocationNational != null ? `${data.customerLocationNational}%` : "", width: thirdWidth },
    { label: "International", value: data.customerLocationInternational != null ? `${data.customerLocationInternational}%` : "", width: thirdWidth },
  ], y);

  y = drawFieldRow(doc, [
    { label: "When are products/services fulfilled?", value: val(data.fulfillmentTiming), width: halfWidth },
    { label: "When is delivery made?", value: val(data.deliveryTiming), width: halfWidth },
  ], y);
  y = drawFieldRow(doc, [
    { label: "When is customer charged?", value: val(data.chargedAt), width: halfWidth },
    { label: "Has retail location?", value: val(data.hasRetailLocation), width: halfWidth },
  ], y);
  if (data.hasRetailLocation && data.retailLocationAddress) {
    y = drawFieldRow(doc, [
      { label: "Retail Location Address", value: val(data.retailLocationAddress), width: contentWidth },
    ], y);
  }
  y = drawFieldRow(doc, [
    { label: "Advertising Methods", value: val(data.advertisingMethods), width: halfWidth },
    { label: "Seasonal Business?", value: data.isSeasonal ? `Yes — ${val(data.seasonalMonths)}` : "No", width: halfWidth },
  ], y);

  // ════════════════════════════════════════════════════
  // PAGE 4: Fee Schedule (Schedule A), Merchant Acceptance, Signatures
  // ════════════════════════════════════════════════════
  doc.addPage();
  y = 14;

  y = drawSectionTitle(doc, "SCHEDULE A — FEE SCHEDULE", y);

  const fee = data.feeSchedule;
  if (fee) {
    // Rate Structure
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40, 40, 40);
    doc.text("Rate Structure", MARGIN_LEFT, y + 2);
    doc.setFont("helvetica", "normal");
    y += 6;

    y = drawFieldRow(doc, [
      { label: "Rate Type", value: val(fee.rateType), width: thirdWidth },
      { label: "Visa/MC/Discover Rate", value: fmtRate(fee.visaMcDiscoverRate), width: thirdWidth },
      { label: "Interchange Plus Rate", value: fmtRate(fee.interchangePlusRate), width: thirdWidth },
    ], y);
    y = drawFieldRow(doc, [
      { label: "Qualified Rate", value: fmtRate(fee.qualifiedRate), width: thirdWidth },
      { label: "Mid-Qual Surcharge", value: fmtRate(fee.midQualSurcharge), width: thirdWidth },
      { label: "Non-Qual Surcharge", value: fmtRate(fee.nonQualSurcharge), width: thirdWidth },
    ], y);
    y = drawFieldRow(doc, [
      { label: "Offline Debit Rate", value: fmtRate(fee.offlineDebitRate), width: thirdWidth },
      { label: "Amex OptBlue Rate", value: fmtRate(fee.amexOptBlueRate), width: thirdWidth },
    ], y);

    // Transaction Fees
    y += 2;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40, 40, 40);
    doc.text("Transaction & Monthly Fees", MARGIN_LEFT, y + 2);
    doc.setFont("helvetica", "normal");
    y += 6;

    y = drawFieldRow(doc, [
      { label: "Authorization Fee", value: fmtFee(fee.authorizationFee), width: thirdWidth },
      { label: "Transaction Fee", value: fmtFee(fee.transactionFee), width: thirdWidth },
      { label: "Batch Fee", value: fmtFee(fee.batchFee), width: thirdWidth },
    ], y);
    y = drawFieldRow(doc, [
      { label: "Monthly Dashboard Fee", value: fmtFee(fee.monthlyDashboardFee), width: thirdWidth },
      { label: "Voice Auth Fee", value: fmtFee(fee.voiceAuthFee), width: thirdWidth },
      { label: "Monthly Minimum", value: fmtFee(fee.monthlyMinimumFee), width: thirdWidth },
    ], y);
    y = drawFieldRow(doc, [
      { label: "Application Fee", value: fmtFee(fee.applicationFee), width: thirdWidth },
      { label: "Chargeback Fee", value: fmtFee(fee.chargebackFee), width: thirdWidth },
      { label: "Retrieval Fee", value: fmtFee(fee.retrievalFee), width: thirdWidth },
    ], y);
    y = drawFieldRow(doc, [
      { label: "AVS Transaction Fee", value: fmtFee(fee.avsTransactionFee), width: thirdWidth },
      { label: "Monthly Fee", value: fmtFee(fee.monthlyFee), width: thirdWidth },
      { label: "Annual Fee", value: fmtFee(fee.annualFee), width: thirdWidth },
    ], y);
    y = drawFieldRow(doc, [
      { label: "Monthly PCI Fee", value: fmtFee(fee.monthlyPciFee), width: thirdWidth },
    ], y);

    if (fee.specialNotes) {
      y += 2;
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("Special Notes:", MARGIN_LEFT, y);
      doc.setFont("helvetica", "normal");
      const noteLines = doc.splitTextToSize(fee.specialNotes, contentWidth);
      doc.text(noteLines, MARGIN_LEFT, y + 4);
      y += 4 + noteLines.length * 3.5;
    }
  } else {
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text("Fee schedule not yet assigned.", MARGIN_LEFT + 3, y + 2);
    doc.setTextColor(0, 0, 0);
    y += 10;
  }

  // ── Merchant Acceptance & Agreement ──
  y = checkPageBreak(doc, y, 50);
  y += 4;
  y = drawSectionTitle(doc, "MERCHANT ACCEPTANCE & AGREEMENT", y);

  doc.setFontSize(7.5);
  doc.setTextColor(40, 40, 40);
  const acceptanceText =
    "By signing below, the undersigned Merchant and its Principals acknowledge that they have read, understand, " +
    "and agree to be bound by all terms and conditions of this Merchant Account Application and Agreement, " +
    "including the attached Terms and Conditions (Sections 1-48), Schedule A (Fee Schedule), and all " +
    "incorporated documents. The Merchant certifies that all information provided in this application is " +
    "true and correct. The Merchant authorizes the Bank and ISO to obtain credit reports on the business " +
    "and each principal listed herein, and to debit the designated bank account for all fees, chargebacks, " +
    "and other amounts due under this Agreement. The Merchant understands that this Agreement is subject to " +
    "approval by the Bank and ISO/MSP. This Agreement shall be effective upon approval and shall continue " +
    "for an initial term of three (3) years, automatically renewing for successive one (1) year terms unless " +
    "terminated in accordance with the Terms and Conditions.";
  const acceptLines = doc.splitTextToSize(acceptanceText, contentWidth);
  doc.text(acceptLines, MARGIN_LEFT, y);
  doc.setTextColor(0, 0, 0);
  y += acceptLines.length * 3.2 + 6;

  // ── Signature Lines ──
  y = checkPageBreak(doc, y, 60);

  // Principal signatures (up to 4)
  for (let i = 0; i < 4; i++) {
    y = checkPageBreak(doc, y, 20);
    const principal = data.principals[i];
    const sigLabel = principal
      ? `Principal ${i + 1}: ${principal.firstName} ${principal.lastName}`
      : `Principal ${i + 1}`;

    const sigData = principal?.signatureBase64 || null;
    y = drawSignatureLine(doc, sigLabel + " — Signature", MARGIN_LEFT, y, contentWidth * 0.55, sigData);

    // Date line next to signature
    const dateX = MARGIN_LEFT + contentWidth * 0.6;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(dateX, y - 8, dateX + contentWidth * 0.35, y - 8);
    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    doc.text("Date", dateX, y - 4);
    if (principal?.signedAt) {
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      doc.text(fmtDate(principal.signedAt), dateX + 2, y - 10);
    }
    doc.setTextColor(0, 0, 0);
    y += 4;
  }

  // ISO signature line
  y = checkPageBreak(doc, y, 18);
  y += 4;
  y = drawSignatureLine(doc, "ISO / MSP Representative — Signature", MARGIN_LEFT, y, contentWidth * 0.55);
  y += 4;

  // Bank signature line
  y = checkPageBreak(doc, y, 18);
  y = drawSignatureLine(doc, "Bank Representative — Signature", MARGIN_LEFT, y, contentWidth * 0.55);

  // ════════════════════════════════════════════════════
  // PAGE 5: Personal Guarantee, Bank Disclosure
  // ════════════════════════════════════════════════════
  doc.addPage();
  y = 14;

  y = drawSectionTitle(doc, "PERSONAL GUARANTEE", y);

  doc.setFontSize(7.5);
  doc.setTextColor(40, 40, 40);
  const guaranteeText =
    "In consideration of the Bank and ISO/MSP entering into this Merchant Account Agreement with the Merchant " +
    "named herein, the undersigned individually and personally, jointly and severally, unconditionally and " +
    "irrevocably guarantee to the Bank and ISO/MSP the full and prompt payment and performance of all " +
    "obligations, indebtedness, and liabilities of the Merchant arising under or in connection with this " +
    "Agreement, including but not limited to chargebacks, fees, fines, penalties, and any other amounts " +
    "owed by the Merchant. This is a continuing guarantee and shall remain in full force and effect until " +
    "all obligations of the Merchant have been fully satisfied and the Agreement has been terminated. " +
    "The guarantor(s) waive notice of acceptance of this guarantee, notice of any default by the Merchant, " +
    "and any other notice to which the guarantor(s) might otherwise be entitled. The guarantor(s) consent " +
    "to any modification, extension, or renewal of the Agreement without notice. The liability of the " +
    "guarantor(s) shall not be affected by any release or discharge of the Merchant in any receivership, " +
    "bankruptcy, or other proceeding. Each guarantor represents that this guarantee is made voluntarily " +
    "and with full understanding of its terms and consequences.";
  const guaranteeLines = doc.splitTextToSize(guaranteeText, contentWidth);
  doc.text(guaranteeLines, MARGIN_LEFT, y);
  doc.setTextColor(0, 0, 0);
  y += guaranteeLines.length * 3.2 + 8;

  // Personal Guarantee Signature Lines
  for (let i = 0; i < Math.min(data.principals.length, 4); i++) {
    y = checkPageBreak(doc, y, 20);
    const p = data.principals[i];
    y = drawSignatureLine(
      doc,
      `Guarantor ${i + 1}: ${p.firstName} ${p.lastName} — Signature`,
      MARGIN_LEFT,
      y,
      contentWidth * 0.55,
      p.signatureBase64
    );
    // Print name line
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    const nameX = MARGIN_LEFT + contentWidth * 0.6;
    doc.line(nameX, y - 8, nameX + contentWidth * 0.35, y - 8);
    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    doc.text("Print Name", nameX, y - 4);
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(`${p.firstName} ${p.lastName}`, nameX + 2, y - 10);
    y += 4;
  }

  // ── Bank Disclosure ──
  y = checkPageBreak(doc, y, 50);
  y += 6;
  y = drawSectionTitle(doc, "BANK DISCLOSURE", y);

  doc.setFontSize(7.5);
  doc.setTextColor(40, 40, 40);
  const disclosureText =
    "IMPORTANT INFORMATION ABOUT PROCEDURES FOR OPENING A NEW ACCOUNT: To help the government fight the " +
    "funding of terrorism and money laundering activities, Federal law requires all financial institutions " +
    "to obtain, verify, and record information that identifies each person who opens an account. What this " +
    "means for you: When you open an account, we will ask for your name, address, date of birth, and other " +
    "information that will allow us to identify you. We may also ask to see your driver's license or other " +
    "identifying documents. The Bank reserves the right to accept or decline any merchant application at " +
    "its sole discretion. The Bank may terminate this Agreement at any time in accordance with the Terms " +
    "and Conditions. The Merchant acknowledges that the Bank is a party to this Agreement and that certain " +
    "terms and conditions are imposed by the Bank and the applicable Card Brand rules. The Merchant agrees " +
    "to comply with all applicable Card Brand rules and regulations, as amended from time to time. The " +
    "Bank's liability under this Agreement shall not exceed the amount of fees actually received by the " +
    "Bank from the Merchant during the twelve (12) months preceding the event giving rise to such liability.";
  const disclosureLines = doc.splitTextToSize(disclosureText, contentWidth);
  doc.text(disclosureLines, MARGIN_LEFT, y);
  doc.setTextColor(0, 0, 0);
  y += disclosureLines.length * 3.2 + 8;

  // ════════════════════════════════════════════════════
  // PAGES 6+: Summary of Key Terms, then Legal Agreement Text
  // ════════════════════════════════════════════════════
  doc.addPage();
  y = 14;

  y = drawSectionTitle(doc, "SUMMARY OF KEY TERMS", y);

  const keyTerms: [string, string][] = [
    ["Agreement Term", "Initial term of three (3) years; auto-renews for one (1) year terms"],
    ["Early Termination Fee", "As specified in Schedule A; applies if terminated before term end"],
    ["Processing Rates", "As specified in Schedule A (Fee Schedule) above"],
    ["Chargeback Liability", "Merchant is liable for all chargebacks and associated fees"],
    ["Reserve Account", "Bank may establish a reserve account at its discretion"],
    ["PCI Compliance", "Merchant must maintain PCI DSS compliance at all times"],
    ["Data Security", "Merchant must protect all cardholder data per Card Brand rules"],
    ["Indemnification", "Merchant indemnifies Bank and ISO against all losses and liabilities"],
    ["Governing Law", "Agreement governed by the laws of the state specified in the Terms"],
    ["Arbitration", "Disputes subject to binding arbitration per Terms and Conditions"],
  ];

  // Table header
  doc.setFillColor(240, 240, 245);
  doc.rect(MARGIN_LEFT, y, contentWidth, 7, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text("Term", MARGIN_LEFT + 3, y + 5);
  doc.text("Description", MARGIN_LEFT + 55, y + 5);
  doc.setFont("helvetica", "normal");
  y += 9;

  for (const [term, desc] of keyTerms) {
    y = checkPageBreak(doc, y, 10);
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.2);
    doc.line(MARGIN_LEFT, y + 5, MARGIN_LEFT + contentWidth, y + 5);

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40, 40, 40);
    doc.text(term, MARGIN_LEFT + 3, y + 3);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    const descLines = doc.splitTextToSize(desc, contentWidth - 58);
    doc.text(descLines, MARGIN_LEFT + 55, y + 3);
    y += Math.max(7, descLines.length * 3.5 + 3);
  }
  y += 6;

  // ════════════════════════════════════════════════════
  // AGREEMENT TERMS AND CONDITIONS — reference to hosted page
  // ════════════════════════════════════════════════════
  y = checkPageBreak(doc, y, 40);
  y = drawSectionTitle(doc, "TERMS AND CONDITIONS", y);

  doc.setFontSize(8);
  doc.setTextColor(40, 40, 40);
  const termsRefText =
    "The complete Terms and Conditions governing this Merchant Account Agreement (Sections 1-48) are incorporated by reference " +
    "and available for review at the following URL:";
  const termsRefLines = doc.splitTextToSize(termsRefText, contentWidth);
  doc.text(termsRefLines, MARGIN_LEFT, y);
  y += termsRefLines.length * 3.5 + 4;

  // URL in purple
  doc.setTextColor(pr, pg, pb);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const termsUrl = "https://doorstax.com/legal/merchant-agreement";
  doc.textWithLink(termsUrl, MARGIN_LEFT, y, { url: termsUrl });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  y += 8;

  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 60);
  const termsNote =
    "By signing this Agreement, Merchant acknowledges that they have read, understand, and agree to be bound by all Terms and " +
    "Conditions available at the above URL, including all provisions regarding fees, chargebacks, reserve accounts, termination, " +
    "indemnification, and dispute resolution. The Terms and Conditions are incorporated herein by reference as if fully set forth in this document. " +
    "Processing services are provided by Maverick BankCard, Inc. (ISO) through Axiom Bank N.A., FFB Bank, Avidia Bank, WestAmerica Bank, " +
    "or North American Banking Company (Bank), depending on the institution processing the Transactions.";
  const termsNoteLines = doc.splitTextToSize(termsNote, contentWidth);
  doc.text(termsNoteLines, MARGIN_LEFT, y);
  doc.setTextColor(0, 0, 0);
  y += termsNoteLines.length * 3 + 6;

  
// ── Footer on every page ──
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Merchant Account Application and Agreement V1.8 | Page ${i} of ${totalPages}`,
      pageWidth / 2,
      ph - 8,
      { align: "center" }
    );
    doc.text(
      "DoorStax Payment Network | Kadima Payments",
      pageWidth / 2,
      ph - 4,
      { align: "center" }
    );
  }

  const buffer = Buffer.from(doc.output("arraybuffer"));
  return buffer;
}

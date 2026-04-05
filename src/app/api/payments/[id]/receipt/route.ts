import { NextResponse } from "next/server";
import { resolveApiSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addBrandingHeader, addAccentLine, addFooter, formatMoney, hexToRgb } from "@/lib/pdf-utils";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await resolveApiSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Fetch the payment with all related data
  const payment = await db.payment.findUnique({
    where: { id },
    include: {
      tenant: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      unit: {
        include: {
          property: {
            include: {
              landlord: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  companyLogo: true,
                  companyName: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  // Authorization: user must be the tenant who owns the payment OR the landlord/PM who owns the property
  const isTenantOwner = payment.tenant.user.id === session.user.id;
  let isLandlordOwner = payment.unit.property.landlord.id === session.user.id;

  // For PM role, also check via team context (handles team members)
  if (!isLandlordOwner && session.user.role === "PM") {
    const effectiveLandlordId = await getEffectiveLandlordId(session.user.id);
    isLandlordOwner = payment.unit.property.landlord.id === effectiveLandlordId;
  }

  if (!isTenantOwner && !isLandlordOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch document settings for branding
  const docSettings = await db.documentSettings.findUnique({
    where: { landlordId: payment.unit.property.landlord.id },
  }).catch(() => null);

  const landlord = payment.unit.property.landlord;
  const primaryColor = docSettings?.primaryColor || "#5B00FF";

  // Generate the receipt PDF
  const doc = new jsPDF();
  const confirmationId = `DSX-${id.slice(0, 8).toUpperCase()}`;

  // Branded header
  let y = await addBrandingHeader(doc, "Payment Receipt", {
    companyLogo: landlord.companyLogo,
    companyName: landlord.companyName,
    primaryColor,
  });

  // Accent line
  y = addAccentLine(doc, y, primaryColor);

  // Confirmation ID
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Confirmation ID: ${confirmationId}`, 14, y);
  doc.setTextColor(0, 0, 0);
  y += 8;

  // Payment details table
  const details: [string, string][] = [];

  // Description first if it exists
  if (payment.description) {
    details.push(["Description", payment.description]);
  }

  // Date with full timestamp
  details.push(
    ["Date", payment.paidAt
      ? payment.paidAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
        + " at " + payment.paidAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short" })
      : payment.dueDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })],
    ["Amount", formatMoney(Number(payment.amount))],
  );

  if (payment.surchargeAmount && Number(payment.surchargeAmount) > 0) {
    details.push(["Surcharge", formatMoney(Number(payment.surchargeAmount))]);
    details.push(["Total", formatMoney(Number(payment.amount) + Number(payment.surchargeAmount))]);
  }

  // Build payment method display string
  let methodDisplay = payment.paymentMethod?.toUpperCase() || "N/A";
  if (payment.cardBrand && payment.cardLast4) {
    const brand = payment.cardBrand.charAt(0).toUpperCase() + payment.cardBrand.slice(1);
    methodDisplay = brand + " •••• " + payment.cardLast4;
  } else if (payment.paymentMethod === "ach" && payment.achLast4) {
    methodDisplay = "ACH •••• " + payment.achLast4;
  }

  details.push(["Payment Method", methodDisplay]);

  // Card/ACH specific details
  if (payment.cardBrand && payment.cardLast4) {
    // Card details already shown in method display
  } else if (payment.cardLast4) {
    details.push(["Card Number", "•••• " + payment.cardLast4]);
  }
  if (payment.achLast4 && !methodDisplay.includes(payment.achLast4)) {
    details.push(["Bank Account", "Ending in " + payment.achLast4]);
  }

  details.push(["Status", payment.status]);

  // Human-readable payment type
  const typeLabel = payment.type === "RENT" ? "Rent Payment"
    : payment.type === "FEE" ? "Fee / Charge"
    : payment.type === "DEPOSIT" ? "Security Deposit"
    : payment.type === "APPLICATION" ? "Application Fee"
    : payment.type;
  details.push(["Payment Type", typeLabel]);

  if (payment.kadimaTransactionId) {
    details.push(["Transaction ID", payment.kadimaTransactionId]);
  }

  autoTable(doc, {
    startY: y,
    head: [["Field", "Details"]],
    body: details,
    theme: "striped",
    headStyles: { fillColor: hexToRgb(primaryColor), textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
    margin: { left: 14, right: 14 },
  });

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // Property details section
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Property Details", 14, y);
  doc.setFont("helvetica", "normal");
  y += 4;

  const address = `${payment.unit.property.address}, ${payment.unit.property.city}, ${payment.unit.property.state} ${payment.unit.property.zip}`;

  autoTable(doc, {
    startY: y,
    body: [
      ["Property", payment.unit.property.name],
      ["Address", address],
      ["Unit", payment.unit.unitNumber],
    ],
    theme: "plain",
    styles: { fontSize: 10 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
    margin: { left: 14, right: 14 },
  });

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // Tenant section
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Tenant", 14, y);
  doc.setFont("helvetica", "normal");
  y += 4;

  autoTable(doc, {
    startY: y,
    body: [
      ["Name", payment.tenant.user.name],
      ["Email", payment.tenant.user.email],
    ],
    theme: "plain",
    styles: { fontSize: 10 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
    margin: { left: 14, right: 14 },
  });

  // Footer
  addFooter(doc, { footerText: docSettings?.footerText || undefined });

  const buffer = Buffer.from(doc.output("arraybuffer"));
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="receipt-${payment.id}.pdf"`,
    },
  });
}

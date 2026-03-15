import { NextResponse } from "next/server";
import { resolveApiSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  addCertificationHeader,
  addFooter,
  formatMoney,
  hexToRgb,
  checkPageBreak,
  drawPaymentScoreBlock,
} from "@/lib/pdf-utils";

export async function GET(req: Request) {
  const session = await resolveApiSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  let tenantId = searchParams.get("tenantId");
  const months = parseInt(searchParams.get("months") || "12", 10);

  const isTenant = session.user.role === "TENANT";
  const isPM = session.user.role === "PM";

  if (!isTenant && !isPM) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // TENANT auto-resolves their own profile
  if (isTenant) {
    const profile = await db.tenantProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!profile) {
      return NextResponse.json(
        { error: "No tenant profile" },
        { status: 404 }
      );
    }
    tenantId = profile.id;
  }

  if (!tenantId) {
    return NextResponse.json(
      { error: "tenantId is required" },
      { status: 400 }
    );
  }

  // Fetch tenant with all related data
  const tenant = await db.tenantProfile.findUnique({
    where: { id: tenantId },
    include: {
      user: { select: { name: true, email: true } },
      unit: {
        include: {
          property: {
            include: {
              landlord: {
                select: { id: true, companyLogo: true, companyName: true },
              },
            },
          },
        },
      },
    },
  });

  if (!tenant || !tenant.unit) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  // PM authorization: must own the property
  if (isPM) {
    const landlordId = await getEffectiveLandlordId(session.user.id);
    if (tenant.unit.property.landlord.id !== landlordId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Active lease
  const lease = await db.lease.findFirst({
    where: { tenantId: tenant.id, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });

  // Date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  // Payment history
  const payments = await db.payment.findMany({
    where: {
      tenantId: tenant.id,
      dueDate: { gte: startDate, lte: endDate },
    },
    orderBy: { dueDate: "asc" },
  });

  // Document settings
  const landlordId = tenant.unit.property.landlord.id;
  const docSettings = await db.documentSettings
    .findUnique({ where: { landlordId } })
    .catch(() => null);

  const primaryColor = docSettings?.primaryColor || "#5B00FF";
  const [pr, pg, pb] = hexToRgb(primaryColor);
  const certId = `CRR-${tenantId.slice(0, 8).toUpperCase()}`;

  // ── Generate PDF ──
  const doc = new jsPDF();

  let y = await addCertificationHeader(
    doc,
    "Certified Rent Payment Record",
    certId,
    {
      companyLogo: tenant.unit.property.landlord.companyLogo,
      companyName: tenant.unit.property.landlord.companyName,
      primaryColor,
    }
  );

  // ── Tenant info ──
  doc.setFontSize(10);
  const tenantInfo: [string, string][] = [
    ["Tenant Name", tenant.user.name],
    ["Email", tenant.user.email],
  ];
  for (const [label, value] of tenantInfo) {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, 60, y);
    y += 6;
  }
  y += 2;

  // ── Property info ──
  const address = `${tenant.unit.property.address}, ${tenant.unit.property.city}, ${tenant.unit.property.state} ${tenant.unit.property.zip}`;
  const propInfo: [string, string][] = [
    ["Property", tenant.unit.property.name],
    ["Address", address],
    ["Unit", tenant.unit.unitNumber],
  ];
  for (const [label, value] of propInfo) {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, 60, y);
    y += 6;
  }
  y += 2;

  // ── Lease info ──
  if (lease) {
    const leaseInfo: [string, string][] = [
      [
        "Lease Period",
        `${lease.startDate.toLocaleDateString()} — ${lease.endDate.toLocaleDateString()}`,
      ],
      ["Monthly Rent", formatMoney(Number(lease.rentAmount))],
      ["Lease Status", lease.status],
    ];
    for (const [label, value] of leaseInfo) {
      doc.setFont("helvetica", "bold");
      doc.text(`${label}:`, 14, y);
      doc.setFont("helvetica", "normal");
      doc.text(value, 60, y);
      y += 6;
    }
  }
  y += 4;

  // ── Payment History Table ──
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text("Payment History", 14, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  y += 4;

  const GRACE_DAYS = 5;

  const tableBody = payments.map((p) => {
    const dueDate = new Date(p.dueDate);
    const monthLabel = dueDate.toLocaleString("en-US", {
      month: "short",
      year: "numeric",
    });
    const paidDate = p.paidAt ? p.paidAt.toLocaleDateString() : "—";
    const amount = formatMoney(Number(p.amount));

    let onTime = "—";
    if (p.status === "COMPLETED" && p.paidAt) {
      const graceDate = new Date(dueDate);
      graceDate.setDate(graceDate.getDate() + GRACE_DAYS);
      onTime = p.paidAt <= graceDate ? "✓" : "✗";
    } else if (p.status === "PENDING" || p.status === "FAILED") {
      onTime = "—";
    }

    return [monthLabel, dueDate.toLocaleDateString(), paidDate, amount, p.status, onTime];
  });

  autoTable(doc, {
    startY: y,
    head: [["Month", "Due Date", "Paid Date", "Amount", "Status", "On-Time"]],
    body: tableBody,
    headStyles: {
      fillColor: [pr, pg, pb],
      textColor: 255,
      fontStyle: "bold",
    },
    styles: { fontSize: 9 },
    columnStyles: { 5: { halign: "center" as const } },
    margin: { left: 14, right: 14 },
  });

  y =
    (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 8;

  // ── Summary calculations ──
  const completed = payments.filter((p) => p.status === "COMPLETED");
  const onTimeCount = completed.filter((p) => {
    if (!p.paidAt) return false;
    const graceDate = new Date(p.dueDate);
    graceDate.setDate(graceDate.getDate() + GRACE_DAYS);
    return p.paidAt <= graceDate;
  }).length;
  const onTimeRate =
    completed.length > 0
      ? Math.round((onTimeCount / completed.length) * 100)
      : 0;
  const totalPaid = completed.reduce((s, p) => s + Number(p.amount), 0);

  // ── Enhanced Summary Box ──
  y = checkPageBreak(doc, y, 30);
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(248, 246, 255);
  doc.setDrawColor(pr, pg, pb);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, y, pageWidth - 28, 24, 3, 3, "FD");

  const summaryLabels = ["Total Months", "Payments", "On-Time Rate", "Total Paid"];
  const summaryValues = [
    `${months}`,
    `${completed.length}/${payments.length}`,
    `${onTimeRate}%`,
    formatMoney(totalPaid),
  ];
  const itemWidth = (pageWidth - 28) / summaryLabels.length;

  summaryLabels.forEach((label, i) => {
    const x = 20 + i * itemWidth;

    // Label
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(label, x, y + 8);

    // Value
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40, 40, 40);
    doc.text(summaryValues[i], x, y + 18);
  });

  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  y += 32;

  // ── DoorStax Payment Score ──
  y = checkPageBreak(doc, y, 44);

  // Calculate consistency
  const missedPayments = payments.filter(
    (p) => p.status === "FAILED" || p.status === "PENDING"
  ).length;

  let consistency: "Excellent" | "Good" | "Fair" | "Poor";
  if (onTimeRate >= 95 && missedPayments === 0) {
    consistency = "Excellent";
  } else if (onTimeRate >= 85 && missedPayments <= 1) {
    consistency = "Good";
  } else if (onTimeRate >= 70) {
    consistency = "Fair";
  } else {
    consistency = "Poor";
  }

  // Calculate risk level (reuses pattern from /api/risk/route.ts)
  const failureCount = payments.filter((p) => p.status === "FAILED").length;
  let riskLevel: "Low" | "Medium" | "High";
  if (failureCount >= 3) {
    riskLevel = "High";
  } else if (failureCount >= 2) {
    riskLevel = "Medium";
  } else {
    riskLevel = "Low";
  }

  y = drawPaymentScoreBlock(
    doc,
    y,
    { onTimeRate, consistency, riskLevel },
    primaryColor
  );

  // ── Certification text ──
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  const certText =
    "This document certifies that the tenant listed above has made the recorded rent payments through the DoorStax platform. " +
    "This record is generated from verified transaction data and may be used for rental history verification, mortgage applications, " +
    "and credit evaluation purposes.";
  const splitText = doc.splitTextToSize(certText, pageWidth - 28);
  doc.text(splitText, 14, y);
  doc.setTextColor(0, 0, 0);

  // Footer
  addFooter(doc, { footerText: docSettings?.footerText || undefined });

  const buffer = Buffer.from(doc.output("arraybuffer"));
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="rent-record-${tenant.user.name.replace(/\s+/g, "-")}.pdf"`,
    },
  });
}

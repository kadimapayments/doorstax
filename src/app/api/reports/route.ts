import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { addBrandingHeader, formatMoney } from "@/lib/pdf-utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "payment-summary";
  const format = searchParams.get("format") || "json";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const startDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const endDate = to ? new Date(to) : new Date();

  const isLandlord = session.user.role === "PM";
  const isTenant = session.user.role === "TENANT";

  if (isTenant) {
    // Tenant reports: payment history
    const profile = await db.tenantProfile.findUnique({
      where: { userId: session.user.id },
      include: { unit: { include: { property: { select: { name: true } } } } },
    });

    if (!profile) {
      return NextResponse.json({ error: "No profile" }, { status: 404 });
    }

    const payments = await db.payment.findMany({
      where: {
        tenantId: profile.id,
        dueDate: { gte: startDate, lte: endDate },
      },
      orderBy: { dueDate: "desc" },
    });

    const rows = payments.map((p) => ({
      date: p.dueDate.toISOString().split("T")[0],
      type: p.type,
      amount: Number(p.amount),
      status: p.status,
      method: p.paymentMethod || "\u2014",
    }));

    if (format === "csv") {
      const csv = [
        "Date,Type,Amount,Status,Method",
        ...rows.map((r) => `${r.date},${r.type},${r.amount},${r.status},${r.method}`),
      ].join("\n");

      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="payment-history.csv"`,
        },
      });
    }

    if (format === "pdf") {
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text("Payment History", 14, 20);
      doc.setFontSize(10);
      doc.text(`${profile.unit?.property.name || ""} \u2014 Unit ${profile.unit?.unitNumber || ""}`, 14, 28);
      doc.text(`Period: ${startDate.toLocaleDateString()} \u2014 ${endDate.toLocaleDateString()}`, 14, 34);

      autoTable(doc, {
        startY: 40,
        head: [["Date", "Type", "Amount", "Status", "Method"]],
        body: rows.map((r) => [r.date, r.type, formatMoney(r.amount), r.status, r.method]),
      });

      const buffer = Buffer.from(doc.output("arraybuffer"));
      return new Response(buffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="payment-history.pdf"`,
        },
      });
    }

    return NextResponse.json(rows);
  }

  if (!isLandlord) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);

  // Fetch landlord's company branding for PDF reports
  const landlordUser = await db.user.findUnique({
    where: { id: landlordId },
    select: { companyLogo: true, companyName: true },
  });

  // Landlord reports
  if (type === "payment-summary") {
    const payments = await db.payment.findMany({
      where: {
        landlordId,
        dueDate: { gte: startDate, lte: endDate },
      },
      include: {
        tenant: { include: { user: { select: { name: true } } } },
        unit: { select: { unitNumber: true, property: { select: { name: true } } } },
      },
      orderBy: { dueDate: "desc" },
    });

    const rows = payments.map((p) => ({
      date: p.dueDate.toISOString().split("T")[0],
      tenant: p.tenant.user.name,
      property: p.unit.property.name,
      unit: p.unit.unitNumber,
      type: p.type,
      amount: Number(p.amount),
      status: p.status,
      method: p.paymentMethod || "\u2014",
    }));

    if (format === "csv") {
      const csv = [
        "Date,Tenant,Property,Unit,Type,Amount,Status,Method",
        ...rows.map((r) => `${r.date},"${r.tenant}","${r.property}",${r.unit},${r.type},${r.amount},${r.status},${r.method}`),
      ].join("\n");

      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="payment-summary.csv"`,
        },
      });
    }

    if (format === "pdf") {
      const doc = new jsPDF({ orientation: "landscape" });

      const headerY = await addBrandingHeader(
        doc,
        "Payment Summary Report",
        { companyLogo: landlordUser?.companyLogo, companyName: landlordUser?.companyName }
      );

      doc.setFontSize(10);
      doc.text(`Period: ${startDate.toLocaleDateString()} \u2014 ${endDate.toLocaleDateString()}`, 14, headerY + 2);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, headerY + 8);

      const total = rows.reduce((s, r) => s + r.amount, 0);
      const collected = rows.filter((r) => r.status === "COMPLETED").reduce((s, r) => s + r.amount, 0);
      doc.text(`Total: ${formatMoney(total)} | Collected: ${formatMoney(collected)}`, 14, headerY + 14);

      autoTable(doc, {
        startY: headerY + 20,
        head: [["Date", "Tenant", "Property", "Unit", "Type", "Amount", "Status", "Method"]],
        body: rows.map((r) => [r.date, r.tenant, r.property, r.unit, r.type, formatMoney(r.amount), r.status, r.method]),
      });

      const buffer = Buffer.from(doc.output("arraybuffer"));
      return new Response(buffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="payment-summary.pdf"`,
        },
      });
    }

    return NextResponse.json(rows);
  }

  if (type === "property-income") {
    const properties = await db.property.findMany({
      where: { landlordId },
      include: {
        units: {
          include: {
            payments: {
              where: { dueDate: { gte: startDate, lte: endDate }, status: "COMPLETED" },
            },
          },
        },
      },
    });

    const rows = properties.map((p) => ({
      property: p.name,
      units: p.units.length,
      income: p.units.reduce(
        (sum, u) => sum + u.payments.reduce((s, pay) => s + Number(pay.amount), 0),
        0
      ),
      transactions: p.units.reduce((sum, u) => sum + u.payments.length, 0),
    }));

    if (format === "csv") {
      const csv = [
        "Property,Units,Income,Transactions",
        ...rows.map((r) => `"${r.property}",${r.units},${r.income},${r.transactions}`),
      ].join("\n");

      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="property-income.csv"`,
        },
      });
    }

    if (format === "pdf") {
      const doc = new jsPDF();

      const headerY = await addBrandingHeader(
        doc,
        "Property Income Report",
        { companyLogo: landlordUser?.companyLogo, companyName: landlordUser?.companyName }
      );

      doc.setFontSize(10);
      doc.text(`Period: ${startDate.toLocaleDateString()} \u2014 ${endDate.toLocaleDateString()}`, 14, headerY + 2);

      autoTable(doc, {
        startY: headerY + 8,
        head: [["Property", "Units", "Income", "Transactions"]],
        body: rows.map((r) => [r.property, r.units, formatMoney(r.income), r.transactions]),
      });

      const buffer = Buffer.from(doc.output("arraybuffer"));
      return new Response(buffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="property-income.pdf"`,
        },
      });
    }

    return NextResponse.json(rows);
  }

  if (type === "delinquency") {
    // Find tenants who haven't paid this period
    const tenants = await db.tenantProfile.findMany({
      where: { unit: { property: { landlordId } } },
      include: {
        user: { select: { name: true, email: true } },
        unit: {
          select: {
            unitNumber: true,
            rentAmount: true,
            property: { select: { name: true } },
          },
        },
        payments: {
          where: { dueDate: { gte: startDate, lte: endDate }, status: "COMPLETED" },
        },
      },
    });

    const rows = tenants
      .filter((t) => t.payments.length === 0 && t.unit)
      .map((t) => ({
        tenant: t.user.name,
        email: t.user.email,
        property: t.unit!.property.name,
        unit: t.unit!.unitNumber,
        rentDue: Number(t.unit!.rentAmount),
      }));

    if (format === "csv") {
      const csv = [
        "Tenant,Email,Property,Unit,Rent Due",
        ...rows.map((r) => `"${r.tenant}","${r.email}","${r.property}",${r.unit},${r.rentDue}`),
      ].join("\n");

      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="delinquency-report.csv"`,
        },
      });
    }

    if (format === "pdf") {
      const doc = new jsPDF();

      const headerY = await addBrandingHeader(
        doc,
        "Delinquency Report",
        { companyLogo: landlordUser?.companyLogo, companyName: landlordUser?.companyName }
      );

      doc.setFontSize(10);
      doc.text(`Period: ${startDate.toLocaleDateString()} \u2014 ${endDate.toLocaleDateString()}`, 14, headerY + 2);
      doc.text(`${rows.length} tenant(s) with no payment`, 14, headerY + 8);

      autoTable(doc, {
        startY: headerY + 14,
        head: [["Tenant", "Email", "Property", "Unit", "Rent Due"]],
        body: rows.map((r) => [r.tenant, r.email, r.property, r.unit, formatMoney(r.rentDue)]),
      });

      const buffer = Buffer.from(doc.output("arraybuffer"));
      return new Response(buffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="delinquency-report.pdf"`,
        },
      });
    }

    return NextResponse.json(rows);
  }

  return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
}

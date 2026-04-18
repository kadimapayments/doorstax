export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/audit";

/**
 * GET    /api/vendor/invoices/[id] — invoice detail (vendor owner only)
 * PATCH  /api/vendor/invoices/[id] — edit while in DRAFT/SUBMITTED
 * DELETE /api/vendor/invoices/[id] — void while in DRAFT/SUBMITTED
 */

async function resolveVendorInvoice(id: string, userId: string) {
  const invoice = await db.vendorInvoice.findUnique({
    where: { id },
    include: {
      vendor: { select: { id: true, userId: true, landlordId: true, name: true } },
      landlord: { select: { id: true, name: true, companyName: true } },
      ticket: { select: { id: true, title: true, status: true } },
      vendorPayout: true,
    },
  });
  if (!invoice || invoice.vendor.userId !== userId) return null;
  return invoice;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "VENDOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const invoice = await resolveVendorInvoice(id, session.user.id);
  if (!invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(invoice);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "VENDOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const invoice = await resolveVendorInvoice(id, session.user.id);
  if (!invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (invoice.status !== "DRAFT" && invoice.status !== "SUBMITTED") {
    return NextResponse.json(
      { error: `Cannot edit an invoice in status ${invoice.status}` },
      { status: 400 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    invoiceNumber?: string;
    amount?: number | string;
    description?: string;
    fileUrl?: string | null;
    ticketId?: string | null;
    submit?: boolean;
  };

  const data: Record<string, unknown> = {};
  if (body.invoiceNumber !== undefined) {
    const v = String(body.invoiceNumber).trim();
    if (!v) return NextResponse.json({ error: "Invoice number cannot be empty" }, { status: 400 });
    data.invoiceNumber = v;
  }
  if (body.amount !== undefined) {
    const n = Number(body.amount);
    if (!Number.isFinite(n) || n <= 0) {
      return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
    }
    data.amount = n;
  }
  if (body.description !== undefined) {
    const v = String(body.description).trim();
    if (!v) return NextResponse.json({ error: "Description cannot be empty" }, { status: 400 });
    data.description = v;
  }
  if (body.fileUrl !== undefined) data.fileUrl = body.fileUrl || null;
  if (body.ticketId !== undefined) data.ticketId = body.ticketId || null;

  // Promote draft → submitted
  if (body.submit && invoice.status === "DRAFT") {
    data.status = "SUBMITTED";
    data.submittedAt = new Date();
  }

  const updated = await db.vendorInvoice.update({ where: { id }, data });

  auditLog({
    userId: session.user.id,
    userRole: "VENDOR",
    action: "UPDATE",
    objectType: "VendorInvoice",
    objectId: id,
    description: `Updated vendor invoice ${invoice.invoiceNumber}`,
    req,
  });

  return NextResponse.json({ invoice: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "VENDOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const invoice = await resolveVendorInvoice(id, session.user.id);
  if (!invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (invoice.status !== "DRAFT" && invoice.status !== "SUBMITTED") {
    return NextResponse.json(
      { error: "Only draft or submitted invoices can be voided" },
      { status: 400 }
    );
  }

  await db.vendorInvoice.update({
    where: { id },
    data: { status: "VOID" },
  });

  auditLog({
    userId: session.user.id,
    userRole: "VENDOR",
    action: "DELETE",
    objectType: "VendorInvoice",
    objectId: id,
    description: `Voided vendor invoice ${invoice.invoiceNumber}`,
    req,
  });

  return NextResponse.json({ ok: true });
}

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/audit";

/**
 * Vendor-side invoice endpoints.
 *
 * GET  /api/vendor/invoices           — list the vendor's own invoices across all PMs
 * POST /api/vendor/invoices           — submit a new invoice to a specific PM
 *
 * The vendor picks which PM to invoice via the `landlordId` body field. That
 * must correspond to one of their linked Vendor records — enforced below.
 */

async function requireVendorUser() {
  const session = await auth();
  if (!session?.user || session.user.role !== "VENDOR") {
    return { error: "Unauthorized" as const, status: 401 as const };
  }
  return { userId: session.user.id, email: session.user.email };
}

export async function GET(req: NextRequest) {
  const gate = await requireVendorUser();
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || undefined;
  const pmFilter = url.searchParams.get("pm") || undefined;

  const invoices = await db.vendorInvoice.findMany({
    where: {
      vendor: { userId: gate.userId },
      ...(status ? { status: status as never } : {}),
      ...(pmFilter ? { landlordId: pmFilter } : {}),
    },
    include: {
      landlord: { select: { id: true, name: true, companyName: true } },
      ticket: { select: { id: true, title: true, status: true } },
      vendorPayout: {
        select: { id: true, status: true, paidAt: true, method: true },
      },
    },
    orderBy: [{ submittedAt: "desc" }],
    take: 200,
  });

  return NextResponse.json({ invoices });
}

export async function POST(req: NextRequest) {
  const gate = await requireVendorUser();
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = (await req.json().catch(() => ({}))) as {
    vendorId?: string;
    landlordId?: string;
    ticketId?: string;
    invoiceNumber?: string;
    amount?: number | string;
    description?: string;
    fileUrl?: string;
    draft?: boolean;
  };

  const invoiceNumber = String(body.invoiceNumber || "").trim();
  const description = String(body.description || "").trim();
  const amountNum = Number(body.amount);

  if (!body.vendorId) {
    return NextResponse.json({ error: "Missing vendorId (PM selection)" }, { status: 400 });
  }
  if (!invoiceNumber) {
    return NextResponse.json({ error: "Invoice number is required" }, { status: 400 });
  }
  if (!description) {
    return NextResponse.json({ error: "Description is required" }, { status: 400 });
  }
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
  }

  // Verify the vendor record belongs to this user
  const vendor = await db.vendor.findUnique({
    where: { id: body.vendorId },
    select: { id: true, userId: true, landlordId: true },
  });
  if (!vendor || vendor.userId !== gate.userId) {
    return NextResponse.json(
      { error: "Vendor record not found in your network" },
      { status: 404 }
    );
  }

  // If a ticket is attached, it must belong to that PM + vendor combo
  if (body.ticketId) {
    const ticket = await db.serviceTicket.findUnique({
      where: { id: body.ticketId },
      select: { vendorId: true, landlordId: true },
    });
    if (
      !ticket ||
      ticket.vendorId !== vendor.id ||
      ticket.landlordId !== vendor.landlordId
    ) {
      return NextResponse.json(
        { error: "Ticket not assigned to this vendor/PM" },
        { status: 400 }
      );
    }
  }

  const invoice = await db.vendorInvoice.create({
    data: {
      vendorId: vendor.id,
      landlordId: vendor.landlordId,
      ticketId: body.ticketId || null,
      invoiceNumber,
      amount: amountNum,
      description,
      fileUrl: body.fileUrl || null,
      status: body.draft ? "DRAFT" : "SUBMITTED",
    },
  });

  auditLog({
    userId: gate.userId,
    userRole: "VENDOR",
    action: "CREATE",
    objectType: "VendorInvoice",
    objectId: invoice.id,
    description: `Submitted invoice ${invoiceNumber} ($${amountNum.toFixed(2)}) to PM`,
    req,
  });

  return NextResponse.json({ invoice }, { status: 201 });
}

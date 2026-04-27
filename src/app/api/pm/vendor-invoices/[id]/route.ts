export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveApiSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { auditLog } from "@/lib/audit";

/**
 * GET  /api/pm/vendor-invoices/[id] — detail
 * POST /api/pm/vendor-invoices/[id] — actions: { action: "approve" | "reject", ... }
 *
 * On approve: creates an Expense row (status = INVOICED, approvedBy = PM).
 * On reject: sets status REJECTED + rejectionReason required.
 *
 * Payment happens separately via /api/pm/vendor-payouts.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await resolveApiSession();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const landlordId = await getEffectiveLandlordId(session.user.id);
  const { id } = await params;

  const invoice = await db.vendorInvoice.findUnique({
    where: { id },
    include: {
      vendor: {
        select: {
          id: true,
          name: true,
          company: true,
          category: true,
          email: true,
          phone: true,
          kadimaCustomerId: true,
          kadimaAccountId: true,
          bankName: true,
          bankAccountLast4: true,
        },
      },
      ticket: { select: { id: true, title: true, status: true, unitId: true } },
      vendorPayout: true,
      expense: true,
    },
  });
  if (!invoice || invoice.landlordId !== landlordId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(invoice);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await resolveApiSession();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const landlordId = await getEffectiveLandlordId(session.user.id);
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    action?: "approve" | "reject";
    rejectionReason?: string;
    reviewerNotes?: string;
    propertyId?: string;
  };

  const invoice = await db.vendorInvoice.findUnique({
    where: { id },
    include: {
      ticket: { select: { unit: { select: { propertyId: true } } } },
    },
  });
  if (!invoice || invoice.landlordId !== landlordId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (invoice.status !== "SUBMITTED" && invoice.status !== "UNDER_REVIEW") {
    return NextResponse.json(
      { error: `Cannot act on an invoice in status ${invoice.status}` },
      { status: 400 }
    );
  }

  if (body.action === "reject") {
    const reason = String(body.rejectionReason || "").trim();
    if (!reason) {
      return NextResponse.json(
        { error: "Rejection reason is required" },
        { status: 400 }
      );
    }
    const updated = await db.vendorInvoice.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejectionReason: reason,
        reviewerNotes: body.reviewerNotes || null,
        reviewedById: session.user.id,
        reviewedAt: new Date(),
      },
    });
    auditLog({
      userId: session.user.id,
      userRole: "PM",
      action: "REJECT",
      objectType: "VendorInvoice",
      objectId: id,
      description: `Rejected vendor invoice ${invoice.invoiceNumber}: ${reason}`,
      req,
    });
    return NextResponse.json({ invoice: updated });
  }

  if (body.action === "approve") {
    // We need a property to attach the Expense to. Prefer the ticket's
    // property; fall back to a property supplied in the body.
    let propertyId =
      invoice.ticket?.unit?.propertyId || body.propertyId || null;

    if (!propertyId) {
      // Last-resort: pick the PM's first property so the ledger still works.
      const firstProp = await db.property.findFirst({
        where: { landlordId },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });
      if (!firstProp) {
        return NextResponse.json(
          { error: "No property available to attach the expense" },
          { status: 400 }
        );
      }
      propertyId = firstProp.id;
    }

    const result = await db.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          propertyId: propertyId!,
          landlordId,
          vendorId: invoice.vendorId,
          category: "SERVICES",
          amount: invoice.amount,
          date: new Date(),
          description: `Vendor invoice ${invoice.invoiceNumber}: ${invoice.description}`,
          receiptUrl: invoice.fileUrl,
          status: "INVOICED",
          invoicedAt: new Date(),
          approvedBy: session.user.id,
          approvedAt: new Date(),
          payableBy: "PM",
        },
      });

      const updated = await tx.vendorInvoice.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewedById: session.user.id,
          reviewedAt: new Date(),
          reviewerNotes: body.reviewerNotes || null,
          expenseId: expense.id,
        },
      });

      return { invoice: updated, expense };
    });

    // ── Accounting: journal the vendor-invoice expense ──
    // Outside the transaction so journal failures don't roll back the
    // approval (the expense + invoice update are the source of truth;
    // journal is a derived view that we backfill if it fails). Same
    // pattern as the main expenses POST route after the category-bug
    // fix.
    try {
      const {
        seedDefaultAccounts,
        expenseCategoryToAccountCode,
      } = await import("@/lib/accounting/chart-of-accounts");
      await seedDefaultAccounts(landlordId);
      const { journalExpense } = await import(
        "@/lib/accounting/auto-entries"
      );
      await journalExpense({
        pmId: landlordId,
        expenseId: result.expense.id,
        amount: Number(result.expense.amount),
        expenseAccountCode: expenseCategoryToAccountCode(
          result.expense.category
        ),
        date: result.expense.date || new Date(),
        propertyId: result.expense.propertyId,
        description:
          result.expense.description || `Vendor invoice ${invoice.invoiceNumber}`,
      });
    } catch (journalErr) {
      console.error(
        "[vendor-invoice] Journal failed for expense",
        result.expense.id,
        journalErr
      );
    }

    auditLog({
      userId: session.user.id,
      userRole: "PM",
      action: "APPROVE",
      objectType: "VendorInvoice",
      objectId: id,
      description: `Approved vendor invoice ${invoice.invoiceNumber} → Expense ${result.expense.id}`,
      req,
    });

    return NextResponse.json(result);
  }

  return NextResponse.json(
    { error: "Unknown action — expected 'approve' or 'reject'" },
    { status: 400 }
  );
}

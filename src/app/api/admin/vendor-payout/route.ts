export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAdminContext, canAdmin } from "@/lib/admin-context";
import { db } from "@/lib/db";
import { getMerchantCredentials } from "@/lib/kadima/merchant-context";
import { merchantCreateAchCredit } from "@/lib/kadima/merchant-ach";
import { auditLog } from "@/lib/audit";

/**
 * POST /api/admin/vendor-payout
 *
 * Admin Virtual Terminal — send an ACH credit to a vendor's bank
 * using the PM's merchant creds (the PM that owns that vendor
 * relationship is the merchant of record for the payout).
 *
 * This mirrors /api/pm/vendor-payouts but drops the "vendor must
 * belong to this PM" check; instead it derives the PM from the
 * vendor's landlordId and uses those creds.
 *
 * Gated by `admin:payments`.
 *
 * Body:
 *   vendorId: string (required)
 *   amount:   number (required — dollars)
 *   memo?:    string
 *   invoiceId?: string — if present, the linked VendorInvoice will be
 *             marked PAID on success and its Expense (if any) flipped
 *             to PAID as well.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const adminCtx = await getAdminContext(session.user.id);
  if (!canAdmin(adminCtx, "admin:payments")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    vendorId?: string;
    amount?: number | string;
    invoiceId?: string;
    memo?: string;
  };

  const amount = Number(body.amount);
  if (!body.vendorId) {
    return NextResponse.json({ error: "Vendor is required" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "Amount must be greater than 0" },
      { status: 400 }
    );
  }

  const vendor = await db.vendor.findUnique({
    where: { id: body.vendorId },
    select: {
      id: true,
      landlordId: true,
      name: true,
      kadimaCustomerId: true,
      kadimaAccountId: true,
    },
  });
  if (!vendor) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }
  if (!vendor.kadimaCustomerId || !vendor.kadimaAccountId) {
    return NextResponse.json(
      {
        error:
          "Vendor has no bank account on file. Ask the PM (or the vendor) to add one before running the payout.",
      },
      { status: 400 }
    );
  }

  const landlordId = vendor.landlordId;

  // If linked to an invoice, validate it belongs to the same PM + vendor
  // and is in the APPROVED state — same rules as the PM-side route.
  let invoice = null as null | {
    id: string;
    status: string;
    expenseId: string | null;
    landlordId: string;
    vendorId: string;
    invoiceNumber: string;
  };
  if (body.invoiceId) {
    const inv = await db.vendorInvoice.findUnique({
      where: { id: body.invoiceId },
      select: {
        id: true,
        status: true,
        expenseId: true,
        landlordId: true,
        vendorId: true,
        invoiceNumber: true,
      },
    });
    if (!inv || inv.landlordId !== landlordId || inv.vendorId !== vendor.id) {
      return NextResponse.json(
        { error: "Invoice does not match the selected vendor / PM" },
        { status: 404 }
      );
    }
    if (inv.status !== "APPROVED") {
      return NextResponse.json(
        {
          error: `Invoice must be APPROVED before payment (is ${inv.status})`,
        },
        { status: 400 }
      );
    }
    invoice = inv;
  }

  // Create the payout row up front so we have an ID for the Kadima call
  const payout = await db.vendorPayout.create({
    data: {
      vendorId: vendor.id,
      landlordId,
      amount,
      method: "ach_credit",
      status: "PROCESSING",
      initiatedAt: new Date(),
      memo: body.memo || null,
    },
  });

  // Fire the ACH credit call using the PM's merchant creds
  let kadimaTxId: string | null = null;
  try {
    const creds = await getMerchantCredentials(landlordId);
    const result = (await merchantCreateAchCredit(creds, {
      customerId: vendor.kadimaCustomerId,
      accountId: vendor.kadimaAccountId,
      amount,
      memo: body.memo || `Admin VT payment to ${vendor.name}`,
    })) as { id?: string | number };
    kadimaTxId = result?.id != null ? String(result.id) : null;
  } catch (err) {
    const message = err instanceof Error ? err.message : "ACH credit failed";
    await db.vendorPayout.update({
      where: { id: payout.id },
      data: { status: "FAILED", failedReason: message },
    });
    auditLog({
      userId: session.user.id,
      userRole: "ADMIN",
      action: "FAIL",
      objectType: "VendorPayout",
      objectId: payout.id,
      description: `Admin VT ACH credit failed: ${message}`,
      req,
    });
    return NextResponse.json(
      { error: message, payoutId: payout.id },
      { status: 502 }
    );
  }

  // Success — mark the payout PAID, and any linked invoice + expense too
  const updated = await db.$transaction(async (tx) => {
    const p = await tx.vendorPayout.update({
      where: { id: payout.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
        kadimaTransactionId: kadimaTxId,
      },
    });

    if (invoice) {
      await tx.vendorInvoice.update({
        where: { id: invoice.id },
        data: {
          status: "PAID",
          paidAt: new Date(),
          vendorPayoutId: p.id,
        },
      });
      if (invoice.expenseId) {
        await tx.expense.update({
          where: { id: invoice.expenseId },
          data: { status: "PAID", paidAt: new Date() },
        });
      }
    }
    return p;
  });

  auditLog({
    userId: session.user.id,
    userRole: "ADMIN",
    action: "PAY",
    objectType: "VendorPayout",
    objectId: updated.id,
    description: `Admin VT ACH credit $${amount.toFixed(2)} → ${
      vendor.name
    } (PM ${landlordId})${
      invoice ? ` for invoice ${invoice.invoiceNumber}` : ""
    }`,
    req,
  });

  return NextResponse.json({
    payout: updated,
    kadimaTransactionId: kadimaTxId,
  });
}

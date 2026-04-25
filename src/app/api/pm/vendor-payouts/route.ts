export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveApiSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { getMerchantCredentials } from "@/lib/kadima/merchant-context";
import { merchantCreateAchCredit } from "@/lib/kadima/merchant-ach";
import { pickSecCode } from "@/lib/kadima/sec-code";
import { auditLog } from "@/lib/audit";

/**
 * GET  /api/pm/vendor-payouts — list this PM's vendor payouts
 * POST /api/pm/vendor-payouts — send an ACH credit to a vendor's bank
 *
 * POST body:
 *   vendorId: string        (required — a Vendor in this PM's network)
 *   amount: number          (required — dollars)
 *   invoiceId?: string      (optional — links to a VendorInvoice; marks it PAID on success)
 *   memo?: string           (optional — appears on the ACH transaction)
 *
 * On success the vendor's invoice (if any) transitions to PAID and the linked
 * Expense row (created at approval time) also flips to PAID.
 */
export async function GET(req: NextRequest) {
  const session = await resolveApiSession();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const landlordId = await getEffectiveLandlordId(session.user.id);
  const status = req.nextUrl.searchParams.get("status") || undefined;

  const payouts = await db.vendorPayout.findMany({
    where: {
      landlordId,
      ...(status ? { status: status as never } : {}),
    },
    include: {
      vendor: { select: { id: true, name: true, company: true } },
      invoice: { select: { id: true, invoiceNumber: true, description: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ payouts });
}

export async function POST(req: NextRequest) {
  const session = await resolveApiSession();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const landlordId = await getEffectiveLandlordId(session.user.id);

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

  // Verify vendor belongs to this PM
  const vendor = await db.vendor.findUnique({
    where: { id: body.vendorId },
    select: {
      id: true,
      landlordId: true,
      name: true,
      kadimaCustomerId: true,
      kadimaAccountId: true,
      bankName: true,
      bankAccountLast4: true,
    },
  });
  if (!vendor || vendor.landlordId !== landlordId) {
    return NextResponse.json(
      { error: "Vendor not in your network" },
      { status: 404 }
    );
  }
  if (!vendor.kadimaCustomerId || !vendor.kadimaAccountId) {
    return NextResponse.json(
      {
        error:
          "Vendor has no bank account on file. Ask them to add one in their portal, or add it for them from the vendor detail page.",
      },
      { status: 400 }
    );
  }

  // If linked to an invoice, make sure it's in this PM's network and in the
  // right state.
  let invoice = null as null | {
    id: string;
    status: string;
    amount: unknown;
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
        amount: true,
        expenseId: true,
        landlordId: true,
        vendorId: true,
        invoiceNumber: true,
      },
    });
    if (!inv || inv.landlordId !== landlordId || inv.vendorId !== vendor.id) {
      return NextResponse.json(
        { error: "Invoice not found in your queue" },
        { status: 404 }
      );
    }
    if (inv.status !== "APPROVED") {
      return NextResponse.json(
        { error: `Invoice must be APPROVED before payment (is ${inv.status})` },
        { status: 400 }
      );
    }
    invoice = inv;
  }

  // Create the VendorPayout row up front in PROCESSING so we have an ID for
  // the Kadima call + audit trail.
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

  // Fire the Kadima ACH credit call
  let kadimaTxId: string | null = null;
  try {
    const creds = await getMerchantCredentials(landlordId);
    // B2B credit (merchant → vendor bank) → CCD per NACHA.
    const result = (await merchantCreateAchCredit(creds, {
      customerId: vendor.kadimaCustomerId,
      accountId: vendor.kadimaAccountId,
      amount,
      secCode: pickSecCode({ kind: "vendor_payout" }),
      memo: body.memo || `Payment to ${vendor.name}`,
    })) as { id?: string | number };
    kadimaTxId = result?.id != null ? String(result.id) : null;
  } catch (err) {
    const message = err instanceof Error ? err.message : "ACH credit failed";
    await db.vendorPayout.update({
      where: { id: payout.id },
      data: {
        status: "FAILED",
        failedReason: message,
      },
    });
    auditLog({
      userId: session.user.id,
      userRole: "PM",
      action: "FAIL",
      objectType: "VendorPayout",
      objectId: payout.id,
      description: `ACH credit failed: ${message}`,
      req,
    });
    return NextResponse.json(
      { error: message, payoutId: payout.id },
      { status: 502 }
    );
  }

  // Success — flip the payout and any linked invoice + expense to PAID.
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
    userRole: "PM",
    action: "PAY",
    objectType: "VendorPayout",
    objectId: updated.id,
    description: `ACH credit $${amount.toFixed(2)} → ${vendor.name}${
      invoice ? ` for invoice ${invoice.invoiceNumber}` : ""
    }`,
    req,
  });

  return NextResponse.json({
    payout: updated,
    kadimaTransactionId: kadimaTxId,
  });
}

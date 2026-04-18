export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAchCustomerWithAccount } from "@/lib/kadima/customer-vault";
import { formatPhoneE164 } from "@/lib/kadima/phone";

/**
 * Vendor self-serve bank account setup.
 *
 * POST — { bankName, routingNumber, accountNumber, accountType? }
 *        Creates a Kadima ACH customer + first account via the one-shot
 *        createAchCustomerWithAccount helper, then stores the returned
 *        customerId + accountId + masked bank details on ALL Vendor rows
 *        linked to this user.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "VENDOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { bankName, routingNumber, accountNumber, accountType } = body as {
    bankName?: string;
    routingNumber?: string;
    accountNumber?: string;
    accountType?: "checking" | "savings";
  };

  if (!routingNumber || !accountNumber) {
    return NextResponse.json(
      { error: "Routing and account number are required" },
      { status: 400 }
    );
  }
  if (!/^\d{9}$/.test(routingNumber)) {
    return NextResponse.json(
      { error: "Routing number must be 9 digits" },
      { status: 400 }
    );
  }

  const userRow = await db.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, phone: true, companyName: true },
  });
  if (!userRow) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const firstVendor = await db.vendor.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!firstVendor) {
    return NextResponse.json(
      {
        error:
          "You need to be added by at least one property manager before setting up bank info.",
      },
      { status: 400 }
    );
  }

  const displayName = userRow.companyName || userRow.name || "Vendor";
  const firstName = (userRow.name || "Vendor").split(" ")[0] || "Vendor";
  const lastName =
    (userRow.name || "").split(" ").slice(1).join(" ") || firstName;

  try {
    const result = await createAchCustomerWithAccount({
      accountName: bankName || displayName,
      firstName,
      lastName,
      email: userRow.email || "",
      phone: formatPhoneE164(userRow.phone || undefined) || undefined,
      identificator: `vendor-user-${session.user.id}`,
      routingNumber: String(routingNumber),
      accountNumber: String(accountNumber),
      accountType: accountType === "savings" ? "savings" : "checking",
    });

    // Store on every Vendor row tied to this user. All PMs benefit from the
    // same vetted bank info — PMs can pay this vendor without re-collecting.
    await db.vendor.updateMany({
      where: { userId: session.user.id },
      data: {
        kadimaCustomerId: result.customerId,
        kadimaAccountId: result.accountId,
        bankName: bankName || null,
        bankAccountLast4: String(accountNumber).slice(-4),
        bankRoutingLast4: String(routingNumber).slice(-4),
      },
    });

    return NextResponse.json({
      ok: true,
      bank: {
        bankName: bankName || null,
        accountLast4: String(accountNumber).slice(-4),
        routingLast4: String(routingNumber).slice(-4),
      },
    });
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = err as any;
    console.error("[vendor/bank] Kadima ACH create failed:", {
      message: e?.message,
      status: e?.response?.status,
      data: e?.response?.data,
    });
    return NextResponse.json(
      {
        error: "Bank vault failed",
        detail: e?.response?.data?.message || e?.message,
      },
      { status: 502 }
    );
  }
}

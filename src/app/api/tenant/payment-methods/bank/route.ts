import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveTenantUserId } from "@/lib/impersonation";
import { z } from "zod";
import { vaultClient } from "@/lib/kadima/client";
import { deleteAccount } from "@/lib/kadima/customer-vault";

/**
 * /api/tenant/payment-methods/bank
 *
 * Tenant bank-account vault management. Two operations:
 *
 *  POST   — add or replace a bank account. Calls POST /ach/customer on
 *           Kadima (which provisions the ACH customer + first account
 *           in one round-trip) and persists BOTH `kadimaAchCustomerId`
 *           and `kadimaAccountId` to the tenant profile. This is the
 *           ONLY supported way to save an ACH account going forward —
 *           the old "save as side effect of paying" path on
 *           /tenant/pay was unreliable (silent failures + no UI to
 *           recover) and is being retired.
 *
 *  DELETE — remove the saved bank. Best-effort Kadima cleanup
 *           (deleteAccount) followed by clearing the DB fields. If
 *           the tenant's `paymentMethodType` was "ach", flips it to
 *           null so the /pay page doesn't auto-select a tab with no
 *           method behind it.
 *
 * Card management lives at sibling /card route. Card and ACH have
 * different vault namespaces on Kadima; never mix the two.
 */

const addBankSchema = z.object({
  routingNumber: z.string().regex(/^\d{9}$/, "Routing number must be 9 digits"),
  accountNumber: z.string().regex(/^\d{4,17}$/, "Account number must be 4–17 digits"),
  accountType: z.enum(["checking", "savings"]).default("checking"),
  accountHolderName: z.string().min(1, "Account holder name required"),
});

async function loadProfile(session: { user: { id: string; role: string } }) {
  const effectiveUserId = await getEffectiveTenantUserId(session as never);
  if (!effectiveUserId) return null;
  return db.tenantProfile.findUnique({
    where: { userId: effectiveUserId },
    select: {
      id: true,
      kadimaAchCustomerId: true,
      kadimaAccountId: true,
      paymentMethodType: true,
      user: { select: { name: true, email: true, phone: true } },
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "TENANT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = addBankSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const profile = await loadProfile(session);
  if (!profile) {
    return NextResponse.json(
      { error: "Tenant profile not found" },
      { status: 404 }
    );
  }

  // ─── Replace existing bank, if any ───
  // Kadima's POST /ach/customer always creates a new customer +
  // account. If the tenant already has an ACH customer, clean it up
  // first so we don't accumulate orphaned records. Best effort —
  // failures are logged but don't block the new save.
  if (profile.kadimaAchCustomerId && profile.kadimaAccountId) {
    try {
      await deleteAccount(profile.kadimaAchCustomerId, profile.kadimaAccountId);
    } catch (cleanupErr) {
      console.warn(
        "[payment-methods/bank] cleanup of prior ACH account failed:",
        cleanupErr
      );
    }
  }

  // ─── Provision the new ACH customer + account in one Kadima call ───
  // Mirrors the body shape used in the existing onboarding endpoint
  // (src/app/api/tenant/onboarding/payment-method/route.ts:92-112)
  // — kept consistent so both surfaces produce identical Kadima
  // records.
  const fullName = data.accountHolderName.trim();
  const firstName = fullName.split(" ")[0] || profile.user?.name || "Tenant";
  const lastName =
    fullName.split(" ").slice(1).join(" ") ||
    (profile.user?.name?.split(" ").slice(1).join(" ") || "");

  let achCustomerId: string | null = null;
  let accountId: string | null = null;

  try {
    const res = await vaultClient.post("/ach/customer", {
      firstName,
      lastName,
      email: profile.user?.email || session.user.email || "",
      phone: profile.user?.phone || "",
      address1: "On File",
      city: "On File",
      state: "NY",
      zipCode: "10001",
      accountName: fullName,
      routingNumber: data.routingNumber,
      accountNumber: data.accountNumber,
      accountType: data.accountType === "checking" ? "Checking" : "Savings",
      dba: { id: Number(process.env.KADIMA_DBA_ID) },
      accounts: [
        {
          name: fullName,
          type: data.accountType === "checking" ? "Checking" : "Savings",
          accountNumber: data.accountNumber,
          routingNumber: data.routingNumber,
        },
      ],
    });

    // Kadima returns the customer object directly (id at top level,
    // accounts[] inline). Mirror the parsing the onboarding endpoint
    // does so we stay consistent with whatever quirks Kadima ships.
    const result = res.data as { id?: number | string; accounts?: { id?: number | string }[] };
    achCustomerId = result.id != null ? String(result.id) : null;
    accountId = result.accounts?.[0]?.id != null ? String(result.accounts[0].id) : null;

    if (!achCustomerId || !accountId) {
      console.error(
        "[payment-methods/bank] Kadima returned incomplete record:",
        JSON.stringify(result)
      );
      return NextResponse.json(
        { error: "Bank vault provisioning failed" },
        { status: 502 }
      );
    }
  } catch (err: unknown) {
    const e = err as { message?: string; response?: { status?: number; data?: unknown } };
    console.error("[payment-methods/bank] Kadima POST /ach/customer failed:", {
      message: e?.message,
      status: e?.response?.status,
      data: JSON.stringify(e?.response?.data),
    });
    return NextResponse.json(
      { error: "Bank vault provisioning failed" },
      { status: 502 }
    );
  }

  // ─── Persist ───
  // Critical: write BOTH ids. The old onboarding flow forgot
  // kadimaAchCustomerId (the bug behind Cindy's 422 "customer.id is
  // invalid"). The pay route reads kadimaAchCustomerId, not
  // kadimaCustomerId, when calling POST /ach.
  await db.tenantProfile.update({
    where: { id: profile.id },
    data: {
      kadimaAchCustomerId: achCustomerId,
      kadimaAccountId: accountId,
      bankLast4: data.accountNumber.slice(-4),
      bankAccountType: data.accountType,
      // First time saving a method → make it the default. Otherwise
      // leave the existing default alone (e.g. tenant had a card
      // saved as default and is now adding a bank as backup).
      ...(!profile.paymentMethodType && { paymentMethodType: "ach" }),
    },
  });

  return NextResponse.json({
    ok: true,
    bank: {
      last4: data.accountNumber.slice(-4),
      accountType: data.accountType,
    },
  });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user || session.user.role !== "TENANT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await loadProfile(session);
  if (!profile) {
    return NextResponse.json(
      { error: "Tenant profile not found" },
      { status: 404 }
    );
  }

  if (!profile.kadimaAccountId) {
    return NextResponse.json(
      { error: "No bank account on file" },
      { status: 404 }
    );
  }

  // Kadima cleanup is best-effort — if the account is already gone
  // (manually deleted, or the customer record was removed), we still
  // want to clear our local copy so the tenant can re-add.
  if (profile.kadimaAchCustomerId) {
    try {
      await deleteAccount(profile.kadimaAchCustomerId, profile.kadimaAccountId);
    } catch (cleanupErr) {
      console.warn(
        "[payment-methods/bank] Kadima delete failed (continuing to clear local):",
        cleanupErr
      );
    }
  }

  await db.tenantProfile.update({
    where: { id: profile.id },
    data: {
      kadimaAchCustomerId: null,
      kadimaAccountId: null,
      bankLast4: null,
      bankAccountType: null,
      // If ACH was the default, clear the default. Tenant can pick
      // a new one (or just pay via the other method, which will
      // auto-promote next time).
      ...(profile.paymentMethodType === "ach" && { paymentMethodType: null }),
    },
  });

  return NextResponse.json({ ok: true });
}

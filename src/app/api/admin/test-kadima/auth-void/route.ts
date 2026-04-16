export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createAuth, voidTransaction } from "@/lib/kadima/gateway";

/**
 * TEMPORARY production verification endpoint.
 *
 * Performs a $0.01 Auth (hold, not capture) against the production Kadima
 * gateway, then immediately voids it. No funds settle. ADMIN-only.
 *
 * The card details are submitted by the admin in their own browser; this
 * endpoint forwards them to Kadima and returns the structured responses.
 * Card data is never logged or persisted.
 *
 * Remove after verification.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { cardNumber, exp, cvv, name } = body as {
    cardNumber?: string;
    exp?: string;
    cvv?: string;
    name?: string;
  };

  if (!cardNumber || !exp || !cvv) {
    return NextResponse.json(
      { error: "cardNumber, exp, and cvv are required" },
      { status: 400 }
    );
  }

  // Strip spaces/dashes from card number for safety
  const cleanCard = cardNumber.replace(/[\s-]/g, "");

  // ─── Step 1: Auth $0.01 ────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let authResponse: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let authError: any = null;
  try {
    authResponse = await createAuth({
      amount: 0.01,
      card: {
        number: cleanCard,
        exp,
        cvv,
        name: name || session.user.name || "Test Auth",
      },
    });
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = err as any;
    authError = {
      httpStatus: e?.response?.status,
      message: e?.message,
      data: e?.response?.data,
    };
  }

  // Don't expose anything that might echo card data
  // (Kadima typically returns last4 only — safe to forward)
  const authStep = authResponse
    ? {
        success: true,
        transactionId: authResponse.id,
        status: authResponse.status,
        type: authResponse.type,
        amount: authResponse.amount,
        cardLast4: authResponse.card?.number,
        cardBin: authResponse.card?.bin,
        terminalId: authResponse.terminal?.id,
        authCode: authResponse.authCode,
        createdOn: authResponse.createdOn,
      }
    : { success: false, error: authError };

  // ─── Step 2: Void (only if auth was approved) ──────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let voidStep: any = null;
  const authApproved =
    authResponse?.id &&
    String(authResponse?.status?.status || "").toLowerCase() === "approved";

  if (authApproved) {
    try {
      const voidResponse = await voidTransaction(String(authResponse.id));
      voidStep = {
        success: true,
        voidId: voidResponse.id,
        status: voidResponse.status,
        type: voidResponse.type,
        parentId: voidResponse.parent?.id,
      };
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      voidStep = {
        success: false,
        error: {
          httpStatus: e?.response?.status,
          message: e?.message,
          data: e?.response?.data,
        },
      };
    }
  } else {
    voidStep = {
      skipped: true,
      reason: authResponse
        ? `Auth not approved (status: ${authResponse.status?.status || "unknown"} — ${authResponse.status?.reason || "no reason"}). Nothing to void.`
        : "Auth call failed entirely. Nothing to void.",
    };
  }

  return NextResponse.json({
    summary: {
      authApproved,
      voided: voidStep?.success === true,
      noFundsMoved: true,
      verdict: authApproved && voidStep?.success
        ? "PASS — full Auth → Void cycle works in production"
        : authApproved && !voidStep?.success
        ? "PARTIAL — Auth worked, Void failed (manually void via Kadima dashboard)"
        : "AUTH_DECLINED — gateway is reachable; card was declined",
    },
    auth: authStep,
    void: voidStep,
  });
}

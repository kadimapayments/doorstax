export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { kadimaClient, vaultClient } from "@/lib/kadima/client";

/**
 * TEMPORARY admin diagnostic endpoint — verifies that the deployed
 * environment can reach the Kadima API and inspects which environment
 * variables are populated. Non-destructive (no charge, no write).
 *
 * Remove after production cutover is verified.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const envCheck = {
    KADIMA_API_BASE: process.env.KADIMA_API_BASE || "NOT SET (defaults to sandbox)",
    KADIMA_PROCESSOR_BASE: process.env.KADIMA_PROCESSOR_BASE || "NOT SET (defaults to sandbox)",
    KADIMA_DBA_ID: process.env.KADIMA_DBA_ID
      ? "SET (" + String(process.env.KADIMA_DBA_ID).slice(0, 3) + "...)"
      : "NOT SET",
    KADIMA_TERMINAL_ID: process.env.KADIMA_TERMINAL_ID ? "SET" : "NOT SET",
    KADIMA_HOSTED_TERMINAL_ID: process.env.KADIMA_HOSTED_TERMINAL_ID ? "SET" : "NOT SET",
    KADIMA_CAMPAIGN_ID: process.env.KADIMA_CAMPAIGN_ID ? "SET" : "NOT SET",
    KADIMA_API_TOKEN: process.env.KADIMA_API_TOKEN
      ? "SET (length: " + process.env.KADIMA_API_TOKEN.length + ")"
      : "NOT SET",
    KADIMA_WEBHOOK_SECRET: process.env.KADIMA_WEBHOOK_SECRET ? "SET" : "NOT SET",
    KADIMA_PROCESSOR_WEBHOOK_SECRET: process.env.KADIMA_PROCESSOR_WEBHOOK_SECRET ? "SET" : "NOT SET",
    NODE_ENV: process.env.NODE_ENV || "not set",
    VERCEL_ENV: process.env.VERCEL_ENV || "not set",
  };

  // ─── Probe known-good GET endpoints on each base ─────────
  // Gateway base (KADIMA_API_BASE) — used for transactions
  // Dashboard base (KADIMA_PROCESSOR_BASE) — used for vault, customers, DBA
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function probe(label: string, fn: () => Promise<any>) {
    try {
      const { data, status } = await fn();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items: any[] = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data)
        ? data
        : [];
      return {
        label,
        success: true,
        httpStatus: status,
        itemCount: items.length,
        sample: items.slice(0, 2),
      };
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      return {
        label,
        success: false,
        httpStatus: e?.response?.status,
        error: e?.message || "Unknown error",
        responseData: e?.response?.data,
      };
    }
  }

  // Optional probe of a specific transaction id via ?txnId=...
  const url = new URL(req.url);
  const txnId = url.searchParams.get("txnId");

  const apiTests = await Promise.all([
    // Gateway base — list payments (known to work)
    probe("gateway GET /payments?_pageSize=1", () =>
      kadimaClient.get("/payments", { params: { _pageSize: 1 } })
    ),
    // Dashboard base — list vault customers (known to work)
    probe("dashboard GET /customers-vault?_pageSize=1", () =>
      vaultClient.get("/customers-vault", { params: { _pageSize: 1 } })
    ),
    // Probe singular vs plural for a specific txn (read-only)
    ...(txnId
      ? [
          probe("gateway GET /payment/" + txnId, () =>
            kadimaClient.get("/payment/" + txnId)
          ),
          probe("gateway GET /payments/" + txnId, () =>
            kadimaClient.get("/payments/" + txnId)
          ),
        ]
      : []),
  ]);

  return NextResponse.json({ envCheck, apiTests });
}

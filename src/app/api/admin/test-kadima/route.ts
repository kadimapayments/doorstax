export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { kadimaClient } from "@/lib/kadima/client";

/**
 * TEMPORARY admin diagnostic endpoint — verifies that the deployed
 * environment can reach the Kadima API and inspects which environment
 * variables are populated. Non-destructive (no charge, no write).
 *
 * Remove after production cutover is verified.
 */
export async function GET() {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let apiTest: any;
  try {
    const { data, status } = await kadimaClient.get("/terminal");
    // Kadima returns { data: [...], _meta: ... } typically
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data)
      ? data
      : [];
    apiTest = {
      success: true,
      httpStatus: status,
      terminalCount: items.length,
      // Show first 3 only — keep response small
      sampleTerminals: items.slice(0, 3).map((t) => ({
        id: t?.id,
        name: t?.name ?? t?.title ?? null,
      })),
    };
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = err as any;
    apiTest = {
      success: false,
      error: e?.message || "Unknown error",
      httpStatus: e?.response?.status,
      responseData: e?.response?.data,
    };
  }

  return NextResponse.json({ envCheck, apiTest });
}

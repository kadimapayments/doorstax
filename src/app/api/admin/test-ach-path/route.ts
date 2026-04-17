export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { kadimaClient, vaultClient } from "@/lib/kadima/client";

/**
 * TEMPORARY: probe ACH account paths on both gateway + dashboard bases
 * to find the correct one for adding bank accounts.
 *
 * GET /api/admin/test-ach-path?customerId=12345
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const customerId = url.searchParams.get("customerId");
  if (!customerId) {
    return NextResponse.json({ error: "?customerId= required" }, { status: 400 });
  }

  const envInfo = {
    KADIMA_API_BASE: process.env.KADIMA_API_BASE || "NOT SET",
    KADIMA_PROCESSOR_BASE: process.env.KADIMA_PROCESSOR_BASE || "NOT SET",
    KADIMA_DBA_ID: process.env.KADIMA_DBA_ID ? "SET" : "NOT SET",
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function probe(label: string, fn: () => Promise<any>) {
    try {
      const { data, status } = await fn();
      return { label, success: true, httpStatus: status, data };
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      return {
        label,
        success: false,
        httpStatus: e?.response?.status,
        error: e?.message,
        responseData: e?.response?.data,
      };
    }
  }

  const probes = await Promise.all([
    // Probe 1: GET the customer on dashboard base (confirm customer exists)
    probe("dashboard GET /customer-vault/" + customerId, () =>
      vaultClient.get("/customer-vault/" + customerId)
    ),
    // Probe 2: GET ACH accounts on dashboard base (current path)
    probe("dashboard GET /ach/customer/" + customerId + "/account", () =>
      vaultClient.get("/ach/customer/" + customerId + "/account")
    ),
    // Probe 3: GET ACH accounts on gateway base
    probe("gateway GET /ach/customer/" + customerId + "/account", () =>
      kadimaClient.get("/ach/customer/" + customerId + "/account")
    ),
    // Probe 4: Different path patterns that Kadima might use
    probe("dashboard GET /customer-vault/" + customerId + "/accounts", () =>
      vaultClient.get("/customer-vault/" + customerId + "/accounts")
    ),
    // Probe 5: ACH accounts (plural)
    probe("dashboard GET /ach/customer/" + customerId + "/accounts", () =>
      vaultClient.get("/ach/customer/" + customerId + "/accounts")
    ),
  ]);

  return NextResponse.json({ envInfo, probes });
}

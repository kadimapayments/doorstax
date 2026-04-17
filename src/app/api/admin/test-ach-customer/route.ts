export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { vaultClient } from "@/lib/kadima/client";

/**
 * TEMPORARY: probe the correct Kadima path to CREATE an ACH customer.
 * Tries several POST paths with a unique test payload. Remove after use.
 *
 * GET /api/admin/test-ach-customer
 */
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbaId = process.env.KADIMA_DBA_ID;
  if (!dbaId) {
    return NextResponse.json({ error: "KADIMA_DBA_ID not set" }, { status: 500 });
  }

  // Unique per-run identificator to avoid collisions and to find the record later if needed.
  const stamp = Date.now();
  const identificator = `probe-${stamp}`;

  const basePayload = {
    dba: { id: Number(dbaId) },
    firstName: "Probe",
    lastName: "Test",
    email: `probe+${stamp}@doorstax.com`,
    phone: "+18185551234",
    identificator,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function probe(path: string, payload: Record<string, unknown>) {
    try {
      const { data, status } = await vaultClient.post(path, payload);
      return {
        path,
        success: true,
        httpStatus: status,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        returnedId: (data as any)?.id ?? null,
        data,
      };
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      return {
        path,
        success: false,
        httpStatus: e?.response?.status,
        error: e?.message,
        // Truncate HTML 404 pages for readability
        responseData:
          typeof e?.response?.data === "string"
            ? e.response.data.slice(0, 200)
            : e?.response?.data,
      };
    }
  }

  // Try the most likely patterns one-at-a-time with unique identificators so
  // if more than one accepts, we can tell them apart in Kadima's dashboard.
  const probes = [];

  probes.push(
    await probe("/ach/customer", { ...basePayload, identificator: identificator + "-a" })
  );
  probes.push(
    await probe("/ach/customers", { ...basePayload, identificator: identificator + "-b" })
  );
  probes.push(
    await probe("/customer-ach", { ...basePayload, identificator: identificator + "-c" })
  );
  probes.push(
    await probe("/ach/customer-vault", { ...basePayload, identificator: identificator + "-d" })
  );

  return NextResponse.json({ probes });
}

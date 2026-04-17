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

  // Iteratively discover required fields. Kadima typically returns the first
  // missing required field per 422, so each payload is a superset of the prior.
  const v1 = {
    dba: { id: Number(dbaId) },
    accountName: "Probe Test",
    identificator: identificator + "-v1",
  };
  const v2 = {
    ...v1,
    identificator: identificator + "-v2",
    firstName: "Probe",
    lastName: "Test",
    email: `probe+${stamp}@doorstax.com`,
    phone: "+18185551234",
  };
  const v3 = {
    ...v2,
    identificator: identificator + "-v3",
    name: "Probe Test",
    accountType: "Checking",
    type: "Checking",
  };
  const v4 = {
    ...v2,
    identificator: identificator + "-v4",
    customer: {
      firstName: "Probe",
      lastName: "Test",
      email: `probe+${stamp}@doorstax.com`,
      phone: "+18185551234",
    },
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

  // Iterate payload shapes on the known-good /ach/customer path.
  const probes = [];
  probes.push({ label: "v1 (dba + accountName + identificator)", ...(await probe("/ach/customer", v1)) });
  probes.push({ label: "v2 (v1 + firstName/lastName/email/phone)", ...(await probe("/ach/customer", v2)) });
  probes.push({ label: "v3 (v2 + name/accountType/type)", ...(await probe("/ach/customer", v3)) });
  probes.push({ label: "v4 (v1 + nested customer{})", ...(await probe("/ach/customer", v4)) });

  return NextResponse.json({ probes });
}

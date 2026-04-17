export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createCustomer, listCustomers } from "@/lib/kadima/customer-vault";
import { formatPhoneE164 } from "@/lib/kadima/phone";

/**
 * TEMPORARY one-time fix: provision a Kadima vault customer for an agent
 * whose profile was created before the Kadima env vars were configured.
 *
 * POST /api/admin/agents/[id]/fix-vault
 * ADMIN-only. Remove after use.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params; // userId of the agent

  const profile = await db.agentProfile.findUnique({
    where: { userId: id },
    include: { user: { select: { name: true, email: true } } },
  });

  if (!profile) {
    return NextResponse.json({ error: "Agent profile not found" }, { status: 404 });
  }

  if (profile.kadimaCustomerId) {
    return NextResponse.json({
      message: "Already has a vault customer",
      kadimaCustomerId: profile.kadimaCustomerId,
    });
  }

  const nameParts = (profile.user?.name || "Agent").split(" ");
  const firstName = nameParts[0] || "Agent";
  const lastName = nameParts.slice(1).join(" ") || "";
  const email = profile.user?.email || "";
  const phone = formatPhoneE164(profile.phone || undefined);
  const identificator = `agent-${profile.id}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let customerId: string | null = null;

  try {
    // Try to create the customer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: Record<string, unknown> = {
      firstName,
      lastName,
      email,
      identificator,
    };
    if (phone) payload.phone = phone;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await createCustomer(payload as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    customerId = (result as any)?.id ? String((result as any).id) : null;
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = err as any;
    const msg = e?.response?.data?.message || e?.message || "";

    // If "already exists", look up by identificator
    if (e?.response?.status === 400 && msg.toLowerCase().includes("already")) {
      try {
        const existing = await listCustomers({ identificator });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const found = (existing?.items || []).find(
          (c: any) => c.identificator === identificator
        );
        if (found?.id) {
          customerId = String(found.id);
        }
      } catch (lookupErr) {
        return NextResponse.json({
          error: "Customer already exists but lookup failed",
          detail: String(lookupErr),
        }, { status: 500 });
      }
    } else {
      return NextResponse.json({
        error: "Kadima vault creation failed",
        httpStatus: e?.response?.status,
        detail: e?.response?.data || e?.message,
      }, { status: 502 });
    }
  }

  if (!customerId) {
    return NextResponse.json({ error: "Failed to get customer ID" }, { status: 500 });
  }

  // Update the agent profile
  await db.agentProfile.update({
    where: { id: profile.id },
    data: { kadimaCustomerId: customerId },
  });

  return NextResponse.json({
    ok: true,
    kadimaCustomerId: customerId,
    agentId: profile.agentId,
    name: profile.user?.name,
  });
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId, getTeamContext } from "@/lib/team-context";
import { getKadimaError } from "@/lib/kadima/client";
import { getMerchantCredentials } from "@/lib/kadima/merchant-context";
import { merchantCreateAchCredit } from "@/lib/kadima/merchant-ach";
import { auditLog } from "@/lib/audit";
import { notify } from "@/lib/notifications";

/**
 * POST /api/payouts/[id]/process
 * Process an approved payout via Kadima ACH credit to the owner's bank account.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const teamCtx = await getTeamContext(session.user.id);
  if (teamCtx.isTeamMember) {
    return NextResponse.json({ error: "Only account owners can process payouts" }, { status: 403 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);
  const { id } = await params;

  try {
    const payout = await db.ownerPayout.findFirst({
      where: { id, landlordId },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            userId: true,
            kadimaCustomerId: true,
            bankAccountLast4: true,
            achTerminalId: true,
          },
        },
      },
    });

    if (!payout) {
      return NextResponse.json({ error: "Payout not found" }, { status: 404 });
    }

    if (payout.status !== "APPROVED") {
      return NextResponse.json(
        { error: "Only APPROVED payouts can be processed" },
        { status: 400 }
      );
    }

    const owner = payout.owner;

    if (!owner.kadimaCustomerId) {
      return NextResponse.json(
        { error: "Owner does not have a bank account on file. Add one from the owner detail page first." },
        { status: 400 }
      );
    }

    // Resolve PM's merchant credentials for this payout
    const merchantCreds = await getMerchantCredentials(landlordId);

    // Get the first vault account for this customer using PM's credentials
    const { createMerchantVaultClient } = await import("@/lib/kadima/merchant-client");
    const merchantVaultClient = createMerchantVaultClient(merchantCreds);
    const accountsRes = await (async () => {
      const { data } = await merchantVaultClient.get(`/ach/customer/${owner.kadimaCustomerId}/accounts`);
      return data;
    })();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accountsAny = accountsRes as unknown as Record<string, any>;
    const accounts = accountsAny.items || accountsAny.data || accountsRes;
    const accountList = Array.isArray(accounts) ? accounts : [];

    if (accountList.length === 0) {
      return NextResponse.json(
        { error: "No bank account found in vault for this owner" },
        { status: 400 }
      );
    }

    const accountId = String(accountList[0].id);
    const netPayout = Number(payout.netPayout);

    if (netPayout <= 0) {
      return NextResponse.json(
        { error: "Net payout must be greater than $0" },
        { status: 400 }
      );
    }

    // Initiate ACH credit via Kadima using PM's merchant credentials
    const result = await merchantCreateAchCredit(merchantCreds, {
      customerId: owner.kadimaCustomerId,
      accountId,
      amount: netPayout,
      memo: `Payout: ${owner.name}`,
    });

    const transactionId =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result as any)?.id || (result as any)?.data?.id;

    // Update payout status to PROCESSING
    const updated = await db.ownerPayout.update({
      where: { id },
      data: {
        status: "PROCESSING",
        paymentMethod: "kadima_ach",
        kadimaTransactionId: transactionId ? String(transactionId) : undefined,
      },
    });

    auditLog({
      userId: session.user.id,
      userName: session.user.name,
      userRole: session.user.role,
      action: "PROCESS",
      objectType: "Payout",
      objectId: id,
      description: `Initiated ACH payout to ${owner.name} ($${netPayout.toFixed(2)})`,
      newValue: { kadimaTransactionId: transactionId ? String(transactionId) : null },
      req: _req,
    });

    // Notify owner if they have a portal account
    if (owner.userId) {
      notify({
        userId: owner.userId,
        createdById: session.user.id,
        type: "PAYOUT_PROCESSING",
        title: "Your Payout Is Being Processed",
        message: `Your ACH payout of $${netPayout.toFixed(2)} is now being processed and will arrive in 1\u20133 business days.`,
        severity: "info",
        amount: netPayout,
      }).catch(() => {});
    }

    return NextResponse.json({
      ...updated,
      grossRent: Number(updated.grossRent),
      processingFees: Number(updated.processingFees),
      managementFee: Number(updated.managementFee),
      expenses: Number(updated.expenses),
      platformFee: Number(updated.platformFee),
      netPayout: Number(updated.netPayout),
    });
  } catch (err) {
    console.error("Process payout error:", err);
    const message = getKadimaError(err);
    return NextResponse.json(
      { error: `ACH payout failed: ${message}` },
      { status: 500 }
    );
  }
}

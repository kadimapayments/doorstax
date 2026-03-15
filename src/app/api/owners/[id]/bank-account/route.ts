import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import {
  createCustomer,
  addAccount,
  listAccounts,
  deleteAccount,
} from "@/lib/kadima/customer-vault";
import { getKadimaError } from "@/lib/kadima/client";
import { z } from "zod";

const bankAccountSchema = z.object({
  bankName: z.string().min(1, "Bank name is required"),
  routingNumber: z.string().regex(/^\d{9}$/, "Routing number must be 9 digits"),
  accountNumber: z.string().min(4, "Account number is required"),
  accountType: z.enum(["checking", "savings"]),
});

/**
 * POST /api/owners/[id]/bank-account
 * Add a bank account for an owner via Kadima Customer Vault.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);
  const { id } = await params;

  try {
    const owner = await db.owner.findFirst({
      where: { id, landlordId },
    });

    if (!owner) {
      return NextResponse.json({ error: "Owner not found" }, { status: 404 });
    }

    const body = await req.json();
    const data = bankAccountSchema.parse(body);

    let kadimaCustomerId = owner.kadimaCustomerId;

    // Create vault customer if none exists
    if (!kadimaCustomerId) {
      const customerRes = await createCustomer({
        firstName: owner.name.split(" ")[0] || owner.name,
        lastName: owner.name.split(" ").slice(1).join(" ") || "Owner",
        email: owner.email || undefined,
      });
      kadimaCustomerId =
        customerRes.data?.id || (customerRes as unknown as Record<string, unknown>).id as string;

      await db.owner.update({
        where: { id },
        data: { kadimaCustomerId: String(kadimaCustomerId) },
      });
    }

    // Add bank account to vault
    await addAccount(String(kadimaCustomerId), {
      routingNumber: data.routingNumber,
      accountNumber: data.accountNumber,
      accountType: data.accountType,
    });

    // Update owner record with bank info
    const last4 = data.accountNumber.slice(-4);
    await db.owner.update({
      where: { id },
      data: {
        bankName: data.bankName,
        bankAccountLast4: last4,
      },
    });

    return NextResponse.json({
      success: true,
      bankName: data.bankName,
      bankAccountLast4: last4,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0].message },
        { status: 400 }
      );
    }
    console.error("Add bank account error:", err);
    const message = getKadimaError(err);
    return NextResponse.json(
      { error: `Failed to add bank account: ${message}` },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/owners/[id]/bank-account
 * Remove an owner's bank account from vault.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);
  const { id } = await params;

  try {
    const owner = await db.owner.findFirst({
      where: { id, landlordId },
    });

    if (!owner) {
      return NextResponse.json({ error: "Owner not found" }, { status: 404 });
    }

    if (!owner.kadimaCustomerId) {
      return NextResponse.json(
        { error: "No bank account on file" },
        { status: 400 }
      );
    }

    // List and delete all vault accounts
    try {
      const accountsRes = await listAccounts(owner.kadimaCustomerId);
      const accounts = accountsRes.data || accountsRes;
      const accountList = Array.isArray(accounts) ? accounts : [];

      for (const acct of accountList) {
        await deleteAccount(owner.kadimaCustomerId, acct.id);
      }
    } catch (vaultErr) {
      console.error("Vault account cleanup error:", vaultErr);
      // Continue to clear local record even if vault fails
    }

    // Clear local bank info
    await db.owner.update({
      where: { id },
      data: {
        bankName: null,
        bankAccountLast4: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Remove bank account error:", err);
    return NextResponse.json(
      { error: "Failed to remove bank account" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { addAccount } from "@/lib/kadima/customer-vault";
import { vaultClient } from "@/lib/kadima/client";
import { provisionVaultCustomer } from "@/lib/kadima/provision-vault-customer";
import { assertUnitPropertyApproved } from "@/lib/property-guard";
import { z } from "zod";

const achSchema = z.object({
  routingNumber: z.string().length(9, "Routing number must be 9 digits"),
  accountNumber: z.string().min(4, "Account number is required"),
  accountType: z.enum(["checking", "savings"]),
  accountHolderName: z.string().min(1, "Account holder name is required"),
});

/* ── POST: save payment method (card or ACH) to Kadima vault ── */

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "TENANT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const isAch = body.type === "ach";

    const profile = await db.tenantProfile.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        unitId: true,
        kadimaCustomerId: true,
        kadimaBillingId: true,
        user: { select: { name: true, email: true, phone: true } },
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Underwriter gate: tenants can't vault a payment method for a unit
    // whose property is still in review. This keeps DoorStax from
    // accepting cards into a vault that the PM's merchant account
    // isn't yet cleared to charge against.
    if (profile.unitId) {
      const propertyGuard = await assertUnitPropertyApproved(profile.unitId);
      if (!propertyGuard.ok) {
        return NextResponse.json(
          { error: propertyGuard.reason },
          { status: 403 }
        );
      }
    }

    // Ensure vault customer + billing info exist
    let customerId = profile.kadimaCustomerId;
    let billingId = profile.kadimaBillingId;

    if (!customerId || !billingId) {
      const nameParts = (profile.user?.name || session.user.name || "").split(" ");
      const result = await provisionVaultCustomer({
        tenantProfileId: profile.id,
        firstName: nameParts[0] || "Tenant",
        lastName: nameParts.slice(1).join(" ") || "",
        email: profile.user?.email || session.user.email || "",
        phone: profile.user?.phone || undefined,
      });

      customerId = result.customerId;
      billingId = result.billingId;
    }

    if (!customerId) {
      return NextResponse.json(
        { error: "Failed to create payment vault" },
        { status: 500 }
      );
    }

    if (isAch) {
      // ── ACH Bank Account ──
      const data = achSchema.parse(body);

      // Kadima has separate customer systems: Customer Vault (cards) and ACH (bank accounts).
      // The vault customerId cannot be used for ACH operations.
      // Create an ACH customer with the account in one step.
      let achCustomerId = customerId; // fallback
      try {
        const achCustomerRes = await vaultClient.post("/ach/customer", {
          firstName: data.accountHolderName.split(" ")[0] || "Tenant",
          lastName: data.accountHolderName.split(" ").slice(1).join(" ") || "",
          email: profile.user?.email || session.user.email || "",
          phone: profile.user?.phone || "",
          address1: "On File",
          city: "On File",
          state: "NY",
          zipCode: "10001",
          accountName: data.accountHolderName,
          routingNumber: data.routingNumber,
          accountNumber: data.accountNumber,
          accountType: data.accountType === "checking" ? "Checking" : "Savings",
          dba: { id: Number(process.env.KADIMA_DBA_ID) },
          accounts: [{
            name: data.accountHolderName,
            type: data.accountType === "checking" ? "Checking" : "Savings",
            accountNumber: data.accountNumber,
            routingNumber: data.routingNumber,
          }],
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const achResult = achCustomerRes.data as any;
        achCustomerId = achResult.id ? String(achResult.id) : customerId;
        console.log("[onboarding-payment] Created ACH customer:", achCustomerId);

        // The ACH customer creation with accounts array already creates the account
        const accounts = achResult.accounts || [];
        const newAccount = accounts[0];
        const accountId = newAccount?.id ? String(newAccount.id) : null;

        if (accountId) {
          // Persist BOTH the ACH customer id and the account id. The
          // ACH customer id lives in its own Kadima namespace (separate
          // from the card-vault customer id stored in
          // `kadimaCustomerId`). The pay route uses
          // `kadimaAchCustomerId` when calling POST /ach so Kadima
          // can find the customer; using the card-vault id there
          // returns 422 "customer.id is invalid".
          await db.tenantProfile.update({
            where: { userId: session.user.id },
            data: {
              kadimaAchCustomerId: achCustomerId,
              kadimaAccountId: accountId,
              bankLast4: data.accountNumber.slice(-4),
              bankAccountType: data.accountType,
              paymentMethodType: "ach",
            },
          });

          return NextResponse.json({
            success: true,
            accountId,
            bankLast4: data.accountNumber.slice(-4),
            accountType: data.accountType,
            customerId: achCustomerId,
          });
        }
      } catch (achErr: unknown) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const err = achErr as any;
        console.error("[onboarding-payment] ACH customer creation failed:", {
          message: err?.message,
          status: err?.response?.status,
          data: JSON.stringify(err?.response?.data),
        });
        // Fall through to try the old addAccount method as fallback
      }

      // Fallback: try addAccount on the vault customer (may work for some Kadima configs)
      const accountRes = await addAccount(customerId, {
        routingNumber: data.routingNumber,
        accountNumber: data.accountNumber,
        accountType: data.accountType,
        accountHolderName: data.accountHolderName,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const accountAny = accountRes as unknown as Record<string, any>;
      const accountId = accountAny.id != null ? String(accountAny.id) : null;

      if (!accountId) {
        console.error(
          "[onboarding-payment] addAccount fallback failed for customer",
          customerId,
          "response:",
          JSON.stringify(accountRes)
        );
        return NextResponse.json(
          { error: "Failed to save bank account" },
          { status: 502 }
        );
      }

      // Update tenant profile with ACH vault IDs
      await db.tenantProfile.update({
        where: { userId: session.user.id },
        data: {
          kadimaCustomerId: customerId,
          kadimaBillingId: billingId,
          kadimaAccountId: accountId,
          bankLast4: data.accountNumber.slice(-4),
          bankAccountType: data.accountType,
          paymentMethodType: "ach",
        },
      });

      return NextResponse.json({
        success: true,
        accountId,
        bankLast4: data.accountNumber.slice(-4),
        accountType: data.accountType,
        customerId,
      });
    } else {
      // ── Card ──
      // Card saves now use the Kadima Vault Hosted Card Form (redirect flow).
      // Use POST /api/payments/vault-card-form to get the form URL, then
      // redirect the user there. This route only handles ACH saves.
      return NextResponse.json(
        { error: "Card saves must use the vault card form flow. Call POST /api/payments/vault-card-form instead." },
        { status: 400 }
      );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error("[onboarding-payment] Error:", error);
    return NextResponse.json(
      { error: "Failed to store payment method" },
      { status: 500 }
    );
  }
}

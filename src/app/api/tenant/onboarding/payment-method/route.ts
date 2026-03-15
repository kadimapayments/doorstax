import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { addCard, addAccount } from "@/lib/kadima/customer-vault";
import { provisionVaultCustomer } from "@/lib/kadima/provision-vault-customer";
import { z } from "zod";

const cardSchema = z.object({
  cardToken: z.string().min(1, "Card token is required"),
  cardBrand: z.string().nullable().optional(),
  cardLast4: z.string().nullable().optional(),
  exp: z.string().nullable().optional(),
});

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
        kadimaCustomerId: true,
        kadimaBillingId: true,
        user: { select: { name: true, email: true, phone: true } },
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
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

      const accountRes = await addAccount(customerId, {
        routingNumber: data.routingNumber,
        accountNumber: data.accountNumber,
        accountType: data.accountType,
        accountHolderName: data.accountHolderName,
      });

      const accountAny = accountRes as unknown as Record<string, any>;
      const accountId = accountAny.id != null ? String(accountAny.id) : null;

      if (!accountId) {
        console.error(
          "[onboarding-payment] addAccount failed for customer",
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
      const data = cardSchema.parse(body);

      // Add card to customer vault using hosted fields token + billing.id
      let cardTokenId: string | null = null;
      try {
        const cardPayload: Record<string, unknown> = {
          token: data.cardToken,
        };
        if (data.exp) {
          cardPayload.exp = data.exp;
        }

        const cardRes = await addCard(
          customerId,
          cardPayload as any,
          billingId || undefined
        );
        const cardResAny = cardRes as unknown as Record<string, any>;
        cardTokenId = cardResAny.id != null ? String(cardResAny.id) : null;

        if (!cardTokenId) {
          console.error(
            "[onboarding-payment] addCard returned no ID for customer",
            customerId,
            "response:",
            JSON.stringify(cardRes)
          );
        }
      } catch (cardErr: any) {
        const errData = cardErr?.response?.data;
        const errStatus = cardErr?.response?.status;
        console.error("[onboarding-payment] addCard error:", {
          message: cardErr?.message,
          status: errStatus,
          data: JSON.stringify(errData),
          tokenPrefix: data.cardToken?.substring(0, 20) + "...",
          customerId,
          billingId,
        });
        // DO NOT silently fall back — the card was NOT saved in Kadima.
        // Return the error so the user knows it failed.
        return NextResponse.json(
          {
            error: "Failed to save card to payment vault",
            details: errData?.message || cardErr?.message || "Unknown error",
          },
          { status: 502 }
        );
      }

      // Update tenant profile with vault IDs
      await db.tenantProfile.update({
        where: { userId: session.user.id },
        data: {
          kadimaCustomerId: customerId,
          kadimaBillingId: billingId,
          kadimaCardTokenId: cardTokenId || data.cardToken,
          cardBrand: data.cardBrand,
          cardLast4: data.cardLast4,
          paymentMethodType: "card",
        },
      });

      return NextResponse.json({
        success: true,
        cardBrand: data.cardBrand,
        cardLast4: data.cardLast4,
        fallback: !cardTokenId,
      });
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

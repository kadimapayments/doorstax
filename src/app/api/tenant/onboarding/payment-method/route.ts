import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createCustomer, addCard, addAccount } from "@/lib/kadima/customer-vault";
import { z } from "zod";

const cardSchema = z.object({
  cardToken: z.string().min(1, "Card token is required"),
  cardBrand: z.string().nullable().optional(),
  cardLast4: z.string().nullable().optional(),
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
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    let customerId = profile.kadimaCustomerId;

    // Create customer in Kadima vault if not exists
    if (!customerId) {
      const customerRes = await createCustomer({
        firstName: session.user.name?.split(" ")[0] || "Tenant",
        lastName: session.user.name?.split(" ").slice(1).join(" ") || "",
        email: session.user.email || "",
      });
      customerId = customerRes.data?.id ?? null;
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

      const accountId = accountRes.data?.id;

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

      // Add card to customer vault using hosted fields token
      const cardRes = await addCard(customerId, {
        token: data.cardToken,
      } as any);
      const cardTokenId = cardRes.data?.id;

      if (!cardTokenId) {
        console.error(
          "[onboarding-payment] addCard failed for customer",
          customerId,
          "response:",
          JSON.stringify(cardRes)
        );
      }

      // Update tenant profile with vault IDs
      await db.tenantProfile.update({
        where: { userId: session.user.id },
        data: {
          kadimaCustomerId: customerId,
          kadimaCardTokenId: cardTokenId,
          cardBrand: data.cardBrand,
          cardLast4: data.cardLast4,
          paymentMethodType: "card",
        },
      });

      return NextResponse.json({
        success: true,
        cardBrand: data.cardBrand,
        cardLast4: data.cardLast4,
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

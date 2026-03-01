import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as achService from "@/lib/kadima/ach";
import * as gatewayService from "@/lib/kadima/gateway";
import { z } from "zod";

const createPaymentSchema = z.object({
  unitId: z.string(),
  amount: z.number().positive(),
  paymentMethod: z.enum(["ach", "card"]),
  // ACH fields
  routingNumber: z.string().optional(),
  accountNumber: z.string().optional(),
  accountType: z.enum(["checking", "savings"]).optional(),
  // Card fields (used with vault)
  cardId: z.string().optional(),
  // Vault-based
  useVault: z.boolean().default(false),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const perPage = 20;

  let where = {};

  if (session.user.role === "TENANT") {
    const profile = await db.tenantProfile.findUnique({
      where: { userId: session.user.id },
    });
    if (!profile) {
      return NextResponse.json({ error: "No tenant profile" }, { status: 404 });
    }
    where = { tenantId: profile.id };
  } else if (session.user.role === "LANDLORD") {
    where = { landlordId: session.user.id };
  }

  const [payments, total] = await Promise.all([
    db.payment.findMany({
      where,
      include: {
        unit: { select: { unitNumber: true, property: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.payment.count({ where }),
  ]);

  return NextResponse.json({
    payments,
    meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "TENANT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = createPaymentSchema.parse(body);

    const profile = await db.tenantProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        unit: {
          include: { property: { select: { landlordId: true } } },
        },
      },
    });

    if (!profile || !profile.unit) {
      return NextResponse.json(
        { error: "No unit assigned" },
        { status: 400 }
      );
    }

    // Create payment record (PENDING)
    const payment = await db.payment.create({
      data: {
        tenantId: profile.id,
        unitId: profile.unit.id,
        landlordId: profile.unit.property.landlordId,
        amount: data.amount,
        type: "RENT",
        status: "PENDING",
        paymentMethod: data.paymentMethod,
        dueDate: new Date(),
      },
    });

    let kadimaResult;

    if (data.paymentMethod === "ach") {
      if (data.useVault && profile.kadimaCustomerId) {
        // Use saved bank account
        kadimaResult = await achService.createAchFromVault({
          customerId: profile.kadimaCustomerId,
          accountId: "", // Would come from saved account
          amount: data.amount,
          memo: `Rent payment - ${profile.unit.unitNumber}`,
        });
      } else if (data.routingNumber && data.accountNumber && data.accountType) {
        kadimaResult = await achService.createAchTransaction({
          amount: data.amount,
          firstName: session.user.name.split(" ")[0] || "",
          lastName: session.user.name.split(" ").slice(1).join(" ") || "",
          routingNumber: data.routingNumber,
          accountNumber: data.accountNumber,
          accountType: data.accountType,
          secCode: "WEB",
          memo: `Rent payment - ${profile.unit.unitNumber}`,
        });
      }
    } else if (data.paymentMethod === "card") {
      if (data.useVault && profile.kadimaCustomerId && data.cardId) {
        kadimaResult = await gatewayService.createSaleFromVault({
          customerId: profile.kadimaCustomerId,
          cardId: data.cardId,
          amount: data.amount,
        });
      }
    }

    // Update payment with Kadima transaction ID
    if (kadimaResult?.data) {
      await db.payment.update({
        where: { id: payment.id },
        data: {
          kadimaTransactionId: kadimaResult.data.id,
          kadimaStatus: kadimaResult.data.status,
        },
      });
    }

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

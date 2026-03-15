import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as achService from "@/lib/kadima/ach";
import * as gatewayService from "@/lib/kadima/gateway";
import { getAchTerminalId } from "@/lib/kadima/routing";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { z } from "zod";
import { paymentLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { emit } from "@/lib/events/emitter";

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
  // ACH authorization
  achAuthorized: z.boolean().optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const perPage = 20;
  const statusParam = searchParams.get("status") || undefined;
  const typeParam = searchParams.get("type") || undefined;
  const fromParam = searchParams.get("from") || undefined;
  const toParam = searchParams.get("to") || undefined;
  const tenantIdParam = searchParams.get("tenantId") || undefined;
  const searchParam = searchParams.get("search")?.trim() || undefined;
  const limitParam = searchParams.get("limit")
    ? parseInt(searchParams.get("limit")!, 10)
    : undefined;
  const allowedSortFields = ["createdAt", "amount", "status", "paymentMethod", "dueDate"];
  const rawSort = searchParams.get("sort") || "createdAt";
  const sortParam = allowedSortFields.includes(rawSort) ? rawSort : "createdAt";
  const dirParam = searchParams.get("dir") === "asc" ? "asc" : "desc";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (session.user.role === "TENANT") {
    const profile = await db.tenantProfile.findUnique({
      where: { userId: session.user.id },
    });
    if (!profile) {
      return NextResponse.json({ error: "No tenant profile" }, { status: 404 });
    }
    where.tenantId = profile.id;
  } else if (session.user.role === "PM") {
    where.landlordId = await getEffectiveLandlordId(session.user.id);
  }

  // Allow PM to filter by tenant (used by Statement Builder)
  if (tenantIdParam && session.user.role === "PM") {
    where.tenantId = tenantIdParam;
  }

  if (statusParam) where.status = statusParam;
  if (typeParam) where.type = typeParam;
  if (fromParam || toParam) {
    where.dueDate = {};
    if (fromParam) where.dueDate.gte = new Date(fromParam);
    if (toParam) where.dueDate.lte = new Date(toParam + "T23:59:59.999Z");
  }

  // Full-text search across tenant name, property name, and unit number
  if (searchParam) {
    where.OR = [
      { unit: { property: { name: { contains: searchParam, mode: "insensitive" } } } },
      { unit: { unitNumber: { contains: searchParam, mode: "insensitive" } } },
      { tenant: { user: { name: { contains: searchParam, mode: "insensitive" } } } },
    ];
  }

  const orderBy = { [sortParam]: dirParam };

  const [payments, total] = await Promise.all([
    db.payment.findMany({
      where,
      include: {
        unit: { select: { unitNumber: true, property: { select: { name: true } } } },
        tenant: { select: { user: { select: { name: true } } } },
      },
      orderBy,
      skip: limitParam ? 0 : (page - 1) * perPage,
      take: limitParam || perPage,
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

  // ─── Rate Limiting (by userId) ──────────────────────────────
  const rl = await paymentLimiter.limit(session.user.id);
  if (!rl.success) return rateLimitResponse(rl.reset);

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

    // Calculate fees based on payment method
    const baseAmount = data.amount;
    let surchargeAmount = 0;
    let landlordFee = 0;
    let chargeAmount = baseAmount;

    if (data.paymentMethod === "card") {
      // Card: tenant pays +3.25% surcharge
      surchargeAmount = Math.round(baseAmount * 0.0325 * 100) / 100;
      chargeAmount = baseAmount + surchargeAmount;
    } else {
      // ACH: fee handling depends on owner's achFeeResponsibility setting
      const ownerData = await db.property.findFirst({
        where: { id: profile.unit.propertyId },
        select: { owner: { select: { achFeeResponsibility: true, achRate: true } } },
      });
      const achFeeMode = (ownerData?.owner as any)?.achFeeResponsibility ?? "OWNER";
      const ownerAchRate = Number((ownerData?.owner as any)?.achRate ?? 6);

      if (achFeeMode === "TENANT") {
        // Tenant pays ACH fee as a surcharge (capped at $6)
        surchargeAmount = Math.min(ownerAchRate, 6);
        chargeAmount = baseAmount + surchargeAmount;
        landlordFee = 0;
      } else if (achFeeMode === "PM") {
        // PM absorbs — tenant and owner unaffected
        chargeAmount = baseAmount;
        landlordFee = 0;
      } else {
        // OWNER (default) — deducted from owner payout
        chargeAmount = baseAmount;
        landlordFee = ownerAchRate;
      }
    }

    // Create payment record (PENDING)
    const payment = await db.payment.create({
      data: {
        tenantId: profile.id,
        unitId: profile.unit.id,
        landlordId: profile.unit.property.landlordId,
        amount: baseAmount,
        type: "RENT",
        status: "PENDING",
        paymentMethod: data.paymentMethod,
        dueDate: new Date(),
        surchargeAmount: surchargeAmount > 0 ? surchargeAmount : null,
        landlordFee: landlordFee > 0 ? landlordFee : null,
        ...(data.paymentMethod === "ach" && data.achAuthorized
          ? { achAuthorizedAt: new Date() }
          : {}),
      },
    });

    let kadimaResult;

    // Determine the ACH terminal based on amount routing
    const terminalId = data.paymentMethod === "ach" ? getAchTerminalId(chargeAmount) : undefined;

    if (data.paymentMethod === "ach") {
      if (data.useVault && profile.kadimaCustomerId) {
        kadimaResult = await achService.createAchFromVault({
          customerId: profile.kadimaCustomerId,
          accountId: "",
          amount: chargeAmount,
          memo: `Rent payment - ${profile.unit.unitNumber}`,
          terminalId,
        });
      } else if (data.routingNumber && data.accountNumber && data.accountType) {
        kadimaResult = await achService.createAchTransaction({
          amount: chargeAmount,
          firstName: session.user.name.split(" ")[0] || "",
          lastName: session.user.name.split(" ").slice(1).join(" ") || "",
          routingNumber: data.routingNumber,
          accountNumber: data.accountNumber,
          accountType: data.accountType,
          secCode: "WEB",
          memo: `Rent payment - ${profile.unit.unitNumber}`,
          terminalId,
        });
      }
    } else if (data.paymentMethod === "card") {
      if (data.useVault && profile.kadimaCustomerId && data.cardId) {
        // Charge total including surcharge
        kadimaResult = await gatewayService.createSaleFromVault({
          customerId: profile.kadimaCustomerId,
          cardId: data.cardId,
          amount: chargeAmount,
        });
      }
    }

    // Update payment with Kadima transaction ID and card/ACH details
    if (kadimaResult?.data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = kadimaResult.data as any;
      const cardBrand = d.cardType
        ? String(d.cardType).toLowerCase()
        : undefined;
      const cardLast4 = d.lastFour
        ? String(d.lastFour)
        : undefined;
      const achLast4 = d.accountNumber
        ? String(d.accountNumber).slice(-4)
        : undefined;

      await db.payment.update({
        where: { id: payment.id },
        data: {
          kadimaTransactionId: String(d.id ?? ""),
          kadimaStatus: String(d.status ?? ""),
          ...(cardBrand && { cardBrand }),
          ...(cardLast4 && { cardLast4 }),
          ...(achLast4 && { achLast4 }),
        },
      });
    }

    // Emit payment.created event
    emit({
      eventType: "payment.created",
      aggregateType: "Payment",
      aggregateId: payment.id,
      payload: {
        tenantId: profile.id,
        unitId: profile.unit.id,
        amount: baseAmount,
        paymentMethod: data.paymentMethod,
        totalCharged: chargeAmount,
      },
      emittedBy: session.user.id,
    }).catch(console.error);

    return NextResponse.json(
      {
        ...payment,
        surchargeAmount,
        landlordFee,
        totalCharged: chargeAmount,
      },
      { status: 201 }
    );
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

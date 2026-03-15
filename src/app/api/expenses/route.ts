import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { createExpenseSchema } from "@/lib/validations/expense";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get("propertyId");
  const category = searchParams.get("category");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const landlordId = await getEffectiveLandlordId(session.user.id);
  const where: Record<string, unknown> = { landlordId };
  if (propertyId) where.propertyId = propertyId;
  if (category) where.category = category;
  if (from || to) {
    const dateFilter: Record<string, Date> = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);
    where.date = dateFilter;
  }

  try {
    // If filtering by PROCESSING_FEES category, skip real expenses query
    const isProcessingFeesOnly = category === "PROCESSING_FEES";
    const isOtherCategory = category && category !== "PROCESSING_FEES";

    const expenses = isProcessingFeesOnly
      ? []
      : await db.expense.findMany({
          where,
          include: {
            property: { select: { name: true } },
            unit: { select: { unitNumber: true } },
          },
          orderBy: { date: "desc" },
        });

    // Compute processing fees from completed payments (skip if filtering another category)
    let processingFees: Record<string, unknown>[] = [];
    if (!isOtherCategory) {
      const paymentWhere: Record<string, unknown> = {
        landlordId,
        status: "COMPLETED",
      };
      if (from || to) {
        const paidAtFilter: Record<string, Date> = {};
        if (from) paidAtFilter.gte = new Date(from);
        if (to) paidAtFilter.lte = new Date(to + "T23:59:59.999Z");
        paymentWhere.paidAt = paidAtFilter;
      }
      if (propertyId) {
        paymentWhere.unit = { propertyId };
      }
      // Only ACH generates landlord-absorbed fees ($5 flat).
      // Card surcharges are passed to tenants — NOT a landlord expense.
      paymentWhere.paymentMethod = "ach";

      const completedPayments = await db.payment.findMany({
        where: paymentWhere,
        select: {
          id: true,
          amount: true,
          paymentMethod: true,
          paidAt: true,
          unit: {
            select: {
              unitNumber: true,
              property: { select: { id: true, name: true } },
            },
          },
        },
      });

      processingFees = completedPayments.map((p) => ({
        id: `fee-${p.id}`,
        propertyId: p.unit?.property?.id || "",
        property: { name: p.unit?.property?.name || "Unknown" },
        unitId: null,
        unit: null,
        landlordId,
        category: "PROCESSING_FEES",
        amount: 5.0,
        date: p.paidAt || new Date(),
        description: `ACH processing fee - Unit ${p.unit?.unitNumber || "?"}`,
        vendor: "DoorStax Payment Processing",
        recurring: false,
        receiptUrl: null,
        createdAt: p.paidAt || new Date(),
        updatedAt: p.paidAt || new Date(),
        isProcessingFee: true,
      }));
    }

    // Merge and sort by date descending
    const merged = [...expenses.map((e) => ({ ...e, isProcessingFee: false })), ...processingFees];
    merged.sort(
      (a, b) =>
        new Date(b.date as string).getTime() -
        new Date(a.date as string).getTime()
    );

    const processingFeeTotal = processingFees.reduce(
      (sum, f) => sum + Number(f.amount),
      0
    );

    return NextResponse.json({
      expenses: merged,
      processingFeeTotal,
    });
  } catch (error) {
    console.error("GET /api/expenses error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = createExpenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid data" },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Verify landlord owns the property
    const property = await db.property.findFirst({
      where: { id: data.propertyId, landlordId: session.user.id },
    });
    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    const expense = await db.expense.create({
      data: {
        propertyId: data.propertyId,
        unitId: data.unitId || null,
        landlordId: session.user.id,
        category: data.category,
        amount: data.amount,
        date: new Date(data.date),
        description: data.description,
        vendor: data.vendor || null,
        recurring: data.recurring,
        receiptUrl: data.receiptUrl || null,
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error("POST /api/expenses error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

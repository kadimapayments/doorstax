import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify ownership
  const property = await db.property.findFirst({
    where: { id, landlordId: session.user.id },
    select: { purchasePrice: true },
  });

  if (!property) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    // Total income from completed payments
    const incomeResult = await db.payment.aggregate({
      where: {
        unit: { propertyId: id },
        landlordId: session.user.id,
        status: "COMPLETED",
      },
      _sum: { amount: true },
    });
    const totalIncome = Number(incomeResult._sum.amount || 0);

    // Total expenses
    const expenseResult = await db.expense.aggregate({
      where: { propertyId: id, landlordId: session.user.id },
      _sum: { amount: true },
    });
    const totalExpenses = Number(expenseResult._sum.amount || 0);

    const netIncome = totalIncome - totalExpenses;
    const purchasePrice = property.purchasePrice
      ? Number(property.purchasePrice)
      : null;
    const roi =
      purchasePrice && purchasePrice > 0
        ? (netIncome / purchasePrice) * 100
        : null;

    // Expenses by category
    const expensesByCategory = await db.expense.groupBy({
      by: ["category"],
      where: { propertyId: id, landlordId: session.user.id },
      _sum: { amount: true },
    });

    const categoryBreakdown: Record<string, number> = {};
    for (const row of expensesByCategory) {
      categoryBreakdown[row.category] = Number(row._sum.amount || 0);
    }

    return NextResponse.json({
      totalIncome,
      totalExpenses,
      netIncome,
      purchasePrice,
      roi,
      expensesByCategory: categoryBreakdown,
    });
  } catch (error) {
    console.error("GET /api/properties/[id]/financials error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

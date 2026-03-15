import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateExpenseSchema } from "@/lib/validations/expense";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const expense = await db.expense.findFirst({
    where: { id, landlordId: session.user.id },
    include: {
      property: { select: { name: true } },
      unit: { select: { unitNumber: true } },
    },
  });

  if (!expense) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(expense);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const expense = await db.expense.findFirst({
    where: { id, landlordId: session.user.id },
  });

  if (!expense) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const parsed = updateExpenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid data" },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const updated = await db.expense.update({
      where: { id },
      data: {
        ...data,
        date: data.date ? new Date(data.date) : undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/expenses/[id] error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const expense = await db.expense.findFirst({
    where: { id, landlordId: session.user.id },
  });

  if (!expense) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.expense.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

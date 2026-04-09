import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { createExpenseSchema } from "@/lib/validations/expense";
import { notify } from "@/lib/notifications";
import { expenseInvoiceHtml } from "@/lib/emails/expense-invoice";

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

  const status = searchParams.get("status");
  const landlordId = await getEffectiveLandlordId(session.user.id);
  const where: Record<string, unknown> = { landlordId };
  if (propertyId) where.propertyId = propertyId;
  if (category) where.category = category;
  if (status) where.status = status;
  if (searchParams.get("vendorId")) where.vendorId = searchParams.get("vendorId");
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
            tenant: { include: { user: { select: { name: true } } } },
            vendorRef: { select: { id: true, name: true, company: true, category: true } },
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
    const merged = [
      ...expenses.map((e) => ({
        ...e,
        isProcessingFee: false,
        payableBy: e.payableBy || "OWNER",
        status: e.status || "PENDING",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tenantName: (e as any).tenant?.user?.name || null,
        vendorName: (e as any).vendorRef?.name || e.vendor || null,
        vendorId: e.vendorId || null,
        dueDate: e.dueDate?.toISOString() || null,
      })),
      ...processingFees,
    ];
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
        vendorId: data.vendorId || null,
        recurring: data.recurring,
        receiptUrl: data.receiptUrl || null,
        payableBy: data.payableBy || "OWNER",
        tenantId: data.tenantId || null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        splitConfig: data.splitConfig || undefined,
        notes: data.notes || null,
        status: "PENDING",
      },
    });

    // ── Accounting: auto-create journal entry ──
    try {
      const { seedDefaultAccounts } = await import("@/lib/accounting/chart-of-accounts");
      await seedDefaultAccounts(session.user.id);
      const { journalExpense } = await import("@/lib/accounting/auto-entries");
      journalExpense({
        pmId: session.user.id,
        expenseId: expense.id,
        amount: Number(expense.amount),
        date: expense.date || new Date(),
        propertyId: expense.propertyId,
        description: expense.description || expense.category || "Property expense",
      }).catch((e) => console.error("[accounting] Expense journal failed:", e));
    } catch (e) {
      console.error("[accounting] Trigger error:", e);
    }

    // ─── Handle payableBy logic ────────────────────────────
    const dueDateFinal = data.dueDate
      ? new Date(data.dueDate)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    if (data.payableBy === "TENANT" && data.tenantId) {
      // Resolve unit for the tenant
      const tenantProfile = await db.tenantProfile.findUnique({
        where: { id: data.tenantId },
        include: {
          user: { select: { id: true, name: true, email: true } },
          unit: {
            select: {
              id: true,
              unitNumber: true,
              property: { select: { name: true } },
            },
          },
        },
      });

      const unitId = data.unitId || tenantProfile?.unit?.id;
      if (tenantProfile && unitId) {
        // Create a Payment record as an invoice
        const invoicePayment = await db.payment.create({
          data: {
            tenantId: data.tenantId,
            unitId,
            landlordId: session.user.id,
            amount: data.amount,
            type: "FEE",
            status: "PENDING",
            dueDate: dueDateFinal,
            description: data.description,
          },
        });

        // Update expense to INVOICED and link paymentId
        await db.expense.update({
          where: { id: expense.id },
          data: {
            status: "INVOICED",
            invoicedAt: new Date(),
            paymentId: invoicePayment.id,
          },
        });

        // Notify tenant
        if (tenantProfile.user) {
          notify({
            userId: tenantProfile.user.id,
            createdById: session.user.id,
            type: "SYSTEM",
            title: "New Charge on Your Account",
            message: `A charge of $${Number(data.amount).toFixed(2)} for ${data.description} has been added to your account.`,
            severity: "warning",
            amount: Number(data.amount),
            actionUrl: "/tenant/pay",
            email: tenantProfile.user.email ? {
              to: tenantProfile.user.email,
              subject: `New Charge — ${data.description}`,
              html: expenseInvoiceHtml({
                tenantName: tenantProfile.user.name || "Tenant",
                amount: `$${Number(data.amount).toFixed(2)}`,
                description: data.description,
                category: data.category,
                propertyName: tenantProfile.unit?.property?.name || "Your Property",
                unitNumber: tenantProfile.unit?.unitNumber || "",
                dueDate: dueDateFinal.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                }),
              }),
            } : undefined,
          }).catch(console.error);
        }

        // Create ledger CHARGE entry so balance reflects immediately
        // Note: we use direct create instead of createChargeEntry because that
        // function has dedup logic (paymentId: null check) designed for monthly
        // rent charges which would silently skip expense charges.
        try {
          const { periodKeyFromDate } = await import("@/lib/ledger");
          const lastEntry = await db.ledgerEntry.findFirst({
            where: { tenantId: data.tenantId },
            orderBy: { createdAt: "desc" },
            select: { balanceAfter: true },
          });
          const prevBalance = lastEntry ? Number(lastEntry.balanceAfter) : 0;

          await db.ledgerEntry.create({
            data: {
              tenantId: data.tenantId,
              unitId,
              type: "CHARGE",
              amount: Number(data.amount),
              balanceAfter: prevBalance + Number(data.amount),
              periodKey: periodKeyFromDate(new Date()),
              description: data.description,
              paymentId: invoicePayment.id,
              createdById: session.user.id,
            },
          });
        } catch (ledgerErr) {
          console.error("[expense] Ledger charge entry failed:", ledgerErr);
        }
      }
    } else if (data.payableBy === "SPLIT" && Array.isArray(data.splitConfig)) {
      // Create Payment records for each TENANT portion
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const split of data.splitConfig as any[]) {
        if (split.party === "TENANT" && split.tenantId) {
          const tenantProfile = await db.tenantProfile.findUnique({
            where: { id: split.tenantId },
            include: {
              user: { select: { id: true, name: true, email: true } },
              unit: {
                select: {
                  id: true,
                  unitNumber: true,
                  property: { select: { name: true } },
                },
              },
            },
          });
          const unitId = data.unitId || tenantProfile?.unit?.id;
          if (tenantProfile && unitId) {
            const splitAmount = Number(split.amount) || (Number(data.amount) * Number(split.percent)) / 100;
            await db.payment.create({
              data: {
                tenantId: split.tenantId,
                unitId,
                landlordId: session.user.id,
                amount: splitAmount,
                type: "FEE",
                status: "PENDING",
                dueDate: dueDateFinal,
                description: `${data.description} (${split.percent}% share)`,
              },
            });
            if (tenantProfile.user) {
              notify({
                userId: tenantProfile.user.id,
                createdById: session.user.id,
                type: "SYSTEM",
                title: "New Charge on Your Account",
                message: `Your share of ${data.description}: $${splitAmount.toFixed(2)} (${split.percent}%)`,
                severity: "warning",
                amount: splitAmount,
                email: tenantProfile.user.email ? {
                  to: tenantProfile.user.email,
                  subject: `New Charge — ${data.description}`,
                  html: expenseInvoiceHtml({
                    tenantName: tenantProfile.user.name || "Tenant",
                    amount: `$${splitAmount.toFixed(2)}`,
                    description: `${data.description} (${split.percent}% share)`,
                    category: data.category,
                    propertyName: tenantProfile.unit?.property?.name || "Your Property",
                    unitNumber: tenantProfile.unit?.unitNumber || "",
                    dueDate: dueDateFinal.toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    }),
                  }),
                } : undefined,
              }).catch(console.error);
            }

            // Create ledger CHARGE entry for this split portion
            try {
              const { periodKeyFromDate } = await import("@/lib/ledger");
              const lastEntry = await db.ledgerEntry.findFirst({
                where: { tenantId: split.tenantId },
                orderBy: { createdAt: "desc" },
                select: { balanceAfter: true },
              });
              const prevBalance = lastEntry ? Number(lastEntry.balanceAfter) : 0;

              await db.ledgerEntry.create({
                data: {
                  tenantId: split.tenantId,
                  unitId,
                  type: "CHARGE",
                  amount: splitAmount,
                  balanceAfter: prevBalance + splitAmount,
                  periodKey: periodKeyFromDate(new Date()),
                  description: `${data.description} (${split.percent}% share)`,
                  createdById: session.user.id,
                },
              });
            } catch (ledgerErr) {
              console.error("[expense] Split ledger charge entry failed:", ledgerErr);
            }
          }
        }
      }
      await db.expense.update({
        where: { id: expense.id },
        data: { status: "INVOICED", invoicedAt: new Date() },
      });
    }
    // OWNER / PM / INSURANCE: tracking only — no payment record

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error("POST /api/expenses error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

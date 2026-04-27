import { withCronGuard } from "@/lib/cron-guard";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { expenseInvoiceHtml } from "@/lib/emails/expense-invoice";

/**
 * Recurring Expense Processor
 *
 * Duplicates recurring expenses on a monthly basis.
 * For each expense marked as recurring, creates a new expense record
 * for the current month if one doesn't already exist.
 *
 * For tenant-payable recurring expenses, also creates the Payment record
 * and sends the invoice notification.
 *
 * Schedule: 0 7 1 * * (1st of each month at 7 AM UTC)
 */
export const GET = withCronGuard("recurring-expenses", async () => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthStart = new Date(currentYear, currentMonth, 1);
  const monthEnd = new Date(currentYear, currentMonth + 1, 0);

  // Find all recurring expenses
  const recurringExpenses = await db.expense.findMany({
    where: {
      recurring: true,
    },
    include: {
      property: { select: { name: true } },
      unit: { select: { unitNumber: true } },
      tenant: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          unit: { select: { id: true } },
        },
      },
    },
  });

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const expense of recurringExpenses) {
    // Check if this expense already has an entry this month
    const existingThisMonth = await db.expense.findFirst({
      where: {
        propertyId: expense.propertyId,
        unitId: expense.unitId,
        landlordId: expense.landlordId,
        description: expense.description,
        category: expense.category,
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
        id: { not: expense.id },
      },
    });

    if (existingThisMonth) {
      skipped++;
      continue;
    }

    try {
      // Create the new expense for this month
      const newExpense = await db.expense.create({
        data: {
          propertyId: expense.propertyId,
          unitId: expense.unitId,
          landlordId: expense.landlordId,
          category: expense.category,
          amount: expense.amount,
          date: new Date(currentYear, currentMonth, now.getDate()),
          description: expense.description,
          vendor: expense.vendor,
          recurring: false,
          payableBy: expense.payableBy || "OWNER",
          status: expense.payableBy === "TENANT" ? "INVOICED" : "PENDING",
          tenantId: expense.tenantId,
          dueDate: expense.payableBy === "TENANT"
            ? new Date(currentYear, currentMonth + 1, 0)
            : null,
          notes: `Auto-generated from recurring expense (${expense.id})`,
        },
      });

      // ── Accounting: journal the new expense ──
      // Previously this cron created Expense rows that NEVER hit the
      // ledger — recurring monthly mortgage / insurance / etc. were
      // invisible to accounting. Pass expenseAccountCode based on
      // category so each lands in the correct expense account.
      try {
        const {
          seedDefaultAccounts,
          expenseCategoryToAccountCode,
        } = await import("@/lib/accounting/chart-of-accounts");
        await seedDefaultAccounts(expense.landlordId);
        const { journalExpense } = await import(
          "@/lib/accounting/auto-entries"
        );
        await journalExpense({
          pmId: expense.landlordId,
          expenseId: newExpense.id,
          amount: Number(newExpense.amount),
          expenseAccountCode: expenseCategoryToAccountCode(
            newExpense.category
          ),
          date: newExpense.date || new Date(),
          propertyId: newExpense.propertyId,
          description:
            newExpense.description ||
            newExpense.category ||
            "Recurring expense",
        });
      } catch (journalErr) {
        console.error(
          "[recurring-expenses] Journal failed for expense",
          newExpense.id,
          journalErr
        );
      }

      // If tenant-payable, create Payment record and notify
      if (expense.payableBy === "TENANT" && expense.tenantId && expense.tenant) {
        const unitId = expense.unitId || expense.tenant.unit?.id;
        if (unitId) {
          const payment = await db.payment.create({
            data: {
              tenantId: expense.tenantId,
              unitId,
              landlordId: expense.landlordId,
              amount: expense.amount,
              type: "FEE",
              status: "PENDING",
              dueDate: new Date(currentYear, currentMonth + 1, 0),
              description: expense.description,
            },
          });

          // Link expense to payment
          await db.expense.update({
            where: { id: newExpense.id },
            data: { paymentId: payment.id },
          });

          // Notify tenant
          if (expense.tenant.user?.email) {
            await notify({
              userId: expense.tenant.user.id,
              createdById: expense.landlordId,
              type: "SYSTEM",
              title: "Recurring Charge",
              message: `A recurring charge of $${Number(expense.amount).toFixed(2)} for ${expense.description} has been added to your account.`,
              severity: "warning",
              amount: Number(expense.amount),
              email: {
                to: expense.tenant.user.email,
                subject: `Recurring Charge — ${expense.description}`,
                html: expenseInvoiceHtml({
                  tenantName: expense.tenant.user.name || "Tenant",
                  amount: `$${Number(expense.amount).toFixed(2)}`,
                  description: expense.description,
                  category: expense.category,
                  propertyName: expense.property.name,
                  unitNumber: expense.unit?.unitNumber || "",
                  dueDate: new Date(currentYear, currentMonth + 1, 0).toLocaleDateString(),
                }),
              },
            }).catch(console.error);
          }
        }
      }

      created++;
    } catch (err) {
      console.error("[recurring-expenses] Failed to create expense:", err);
      failed++;
    }
  }

  return {
    summary: {
      recurringFound: recurringExpenses.length,
      created,
      skipped,
      failed,
    },
  };
});

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { seedDefaultAccounts } from "@/lib/accounting/chart-of-accounts";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "PM" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await seedDefaultAccounts(session.user.id);

    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period");

    // Get all accounts with their balances
    const accounts = await db.ledgerAccount.findMany({
      where: { pmId: session.user.id, isActive: true },
      orderBy: [{ type: "asc" }, { code: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        normalBalance: true,
        currentBalance: true,
      },
    });

    // If period specified, calculate balances for that period only
    let periodBalances: Map<string, { debit: number; credit: number }> | null = null;
    if (period) {
      const lines = await db.journalEntryLine.findMany({
        where: {
          journalEntry: { pmId: session.user.id, period, isPosted: true },
        },
        select: { accountId: true, debit: true, credit: true },
      });

      periodBalances = new Map();
      for (const line of lines) {
        const existing = periodBalances.get(line.accountId) || { debit: 0, credit: 0 };
        existing.debit += line.debit;
        existing.credit += line.credit;
        periodBalances.set(line.accountId, existing);
      }
    }

    const rows = accounts.map((acct) => {
      const pb = periodBalances?.get(acct.id);
      const debitTotal = pb?.debit ?? (acct.normalBalance === "DEBIT" ? Math.max(0, acct.currentBalance) : Math.max(0, -acct.currentBalance));
      const creditTotal = pb?.credit ?? (acct.normalBalance === "CREDIT" ? Math.max(0, acct.currentBalance) : Math.max(0, -acct.currentBalance));

      return {
        ...acct,
        debitBalance: debitTotal,
        creditBalance: creditTotal,
      };
    });

    const totalDebits = rows.reduce((s, r) => s + r.debitBalance, 0);
    const totalCredits = rows.reduce((s, r) => s + r.creditBalance, 0);

    return NextResponse.json({
      accounts: rows,
      totalDebits,
      totalCredits,
      isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
      period: period || "all-time",
    });
  } catch (err) {
    console.error("[accounting/trial-balance] error:", err);
    return NextResponse.json({ error: "Failed to generate trial balance" }, { status: 500 });
  }
}

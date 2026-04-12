"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  BookOpen,
  FileText,
  Scale,
  Calendar,
  Loader2,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

const TYPE_ORDER = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];
const TYPE_LABELS: Record<string, string> = {
  ASSET: "Assets",
  LIABILITY: "Liabilities",
  EQUITY: "Equity",
  REVENUE: "Revenue",
  EXPENSE: "Expenses",
};

interface Account {
  id: string;
  code: string | null;
  name: string;
  type: string;
  subType: string | null;
  normalBalance: string;
  currentBalance: number;
  isSystem: boolean;
  isActive: boolean;
}

interface JournalEntryData {
  id: string;
  entryNumber: number;
  date: string;
  memo: string | null;
  type: string;
  source: string | null;
  isReversed: boolean;
  property: { name: string } | null;
  lines: Array<{
    id: string;
    debit: number;
    credit: number;
    memo: string | null;
    account: { code: string | null; name: string; type: string };
  }>;
}

export default function AccountingPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<JournalEntryData[]>([]);
  const [trialBalance, setTrialBalance] = useState<{
    accounts: Array<Account & { debitBalance: number; creditBalance: number }>;
    totalDebits: number;
    totalCredits: number;
    isBalanced: boolean;
  } | null>(null);
  const [periods, setPeriods] = useState<Array<{ id: string; period: string; status: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [collapsedTypes, setCollapsedTypes] = useState<Set<string>>(new Set());

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [acctRes, entriesRes, tbRes, periodsRes] = await Promise.all([
        fetch("/api/accounting/accounts"),
        fetch("/api/accounting/journal-entries?limit=30"),
        fetch("/api/accounting/trial-balance"),
        fetch("/api/accounting/periods"),
      ]);

      if (acctRes.ok) setAccounts(await acctRes.json());
      if (entriesRes.ok) {
        const data = await entriesRes.json();
        setEntries(data.entries || []);
      }
      if (tbRes.ok) setTrialBalance(await tbRes.json());
      if (periodsRes.ok) setPeriods(await periodsRes.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function toggleType(type: string) {
    setCollapsedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounting"
        description="Double-entry ledger, chart of accounts, and journal entries."
        actions={
          <Button variant="outline" size="sm" onClick={fetchAll}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>
        }
      />

      <Tabs defaultValue="coa">
        <TabsList>
          <TabsTrigger value="coa">
            <BookOpen className="mr-1.5 h-3.5 w-3.5" />
            Chart of Accounts
          </TabsTrigger>
          <TabsTrigger value="journal">
            <FileText className="mr-1.5 h-3.5 w-3.5" />
            Journal Entries
          </TabsTrigger>
          <TabsTrigger value="trial">
            <Scale className="mr-1.5 h-3.5 w-3.5" />
            Trial Balance
          </TabsTrigger>
          <TabsTrigger value="periods">
            <Calendar className="mr-1.5 h-3.5 w-3.5" />
            Periods
          </TabsTrigger>
        </TabsList>

        {/* Chart of Accounts */}
        <TabsContent value="coa" className="mt-6 space-y-4">
          {TYPE_ORDER.map((type) => {
            const typeAccounts = accounts.filter((a) => a.type === type);
            if (typeAccounts.length === 0) return null;
            const isCollapsed = collapsedTypes.has(type);
            const total = typeAccounts.reduce((s, a) => s + a.currentBalance, 0);

            return (
              <Card key={type} className="border-border">
                <CardHeader className="pb-2">
                  <button onClick={() => toggleType(type)} className="flex w-full items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      {TYPE_LABELS[type]}
                      <span className="text-xs font-normal text-muted-foreground">({typeAccounts.length})</span>
                    </CardTitle>
                    <span className="text-sm font-semibold">{fmt(total)}</span>
                  </button>
                </CardHeader>
                {!isCollapsed && (
                  <CardContent className="pt-0">
                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Code</th>
                            <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Account</th>
                            <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Sub-Type</th>
                            <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {typeAccounts.map((acct) => (
                            <tr key={acct.id} className="border-t">
                              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{acct.code || "\u2014"}</td>
                              <td className="px-3 py-2">
                                <span className={cn("font-medium", !acct.isActive && "opacity-50 line-through")}>{acct.name}</span>
                                {acct.isSystem && <Badge variant="outline" className="ml-2 text-[10px]">System</Badge>}
                              </td>
                              <td className="px-3 py-2 text-xs text-muted-foreground">{acct.subType?.replace(/_/g, " ") || "\u2014"}</td>
                              <td className="px-3 py-2 text-right font-medium">{fmt(acct.currentBalance)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </TabsContent>

        {/* Journal Entries */}
        <TabsContent value="journal" className="mt-6">
          {entries.length === 0 ? (
            <Card className="border-border">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No journal entries yet. Entries are created automatically when payments, expenses, and payouts are processed.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => (
                <Card key={entry.id} className={cn("border-border", entry.isReversed && "opacity-60")}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">JE #{entry.entryNumber}</span>
                        <Badge variant="outline" className="text-[10px]">{entry.type}</Badge>
                        {entry.source && <Badge variant="outline" className="text-[10px]">{entry.source}</Badge>}
                        {entry.isReversed && <Badge variant="destructive" className="text-[10px]">Reversed</Badge>}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {entry.property?.name && <span>{entry.property.name}</span>}
                        <span>{new Date(entry.date).toLocaleDateString()}</span>
                      </div>
                    </div>
                    {entry.memo && <p className="text-sm mb-2">{entry.memo}</p>}
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-muted-foreground">
                          <th className="text-left py-1">Account</th>
                          <th className="text-right py-1">Debit</th>
                          <th className="text-right py-1">Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entry.lines.map((line) => (
                          <tr key={line.id} className="border-t border-border/50">
                            <td className="py-1">
                              <span className="font-mono text-muted-foreground mr-1">{line.account.code}</span>
                              {line.account.name}
                            </td>
                            <td className="py-1 text-right">{line.debit > 0 ? fmt(line.debit) : ""}</td>
                            <td className="py-1 text-right">{line.credit > 0 ? fmt(line.credit) : ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Trial Balance */}
        <TabsContent value="trial" className="mt-6">
          {trialBalance ? (
            <Card className="border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Trial Balance</CardTitle>
                  <Badge variant={trialBalance.isBalanced ? "outline" : "destructive"} className="text-xs">
                    {trialBalance.isBalanced ? "Balanced" : "UNBALANCED"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Code</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Account</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Debit</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trialBalance.accounts
                        .filter((a) => a.debitBalance > 0 || a.creditBalance > 0)
                        .map((acct) => (
                          <tr key={acct.id} className="border-t">
                            <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{acct.code}</td>
                            <td className="px-3 py-2">{acct.name}</td>
                            <td className="px-3 py-2 text-right">{acct.debitBalance > 0 ? fmt(acct.debitBalance) : ""}</td>
                            <td className="px-3 py-2 text-right">{acct.creditBalance > 0 ? fmt(acct.creditBalance) : ""}</td>
                          </tr>
                        ))}
                      <tr className="border-t-2 border-foreground font-bold">
                        <td colSpan={2} className="px-3 py-2">Totals</td>
                        <td className="px-3 py-2 text-right">{fmt(trialBalance.totalDebits)}</td>
                        <td className="px-3 py-2 text-right">{fmt(trialBalance.totalCredits)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Loading trial balance...
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Periods */}
        <TabsContent value="periods" className="mt-6">
          {periods.length === 0 ? (
            <Card className="border-border">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No accounting periods created yet. Periods are auto-created when journal entries are posted.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {periods.map((p) => (
                <Card key={p.id} className="border-border">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{p.period}</span>
                    </div>
                    <Badge
                      variant={p.status === "LOCKED" ? "destructive" : p.status === "CLOSED" ? "secondary" : "outline"}
                      className="text-xs"
                    >
                      {p.status}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

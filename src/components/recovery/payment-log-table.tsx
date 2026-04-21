import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { CheckCircle2, XCircle, AlertTriangle, ExternalLink } from "lucide-react";

interface PaymentLogRow {
  id: string;
  paymentId: string | null;
  periodKey: string;
  amount: number | string;
  wasOnTime: boolean;
  status: "COUNTED" | "MISSED" | "FAILED";
  notes: string | null;
  createdAt: string | Date;
}

interface PaymentLogTableProps {
  logs: PaymentLogRow[];
}

function statusStyle(
  status: PaymentLogRow["status"]
): { label: string; className: string; Icon: React.ComponentType<{ className?: string }> } {
  switch (status) {
    case "COUNTED":
      return {
        label: "Counted",
        className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
        Icon: CheckCircle2,
      };
    case "MISSED":
      return {
        label: "Missed",
        className: "bg-red-500/10 text-red-600 border-red-500/20",
        Icon: XCircle,
      };
    case "FAILED":
      return {
        label: "Failed",
        className: "bg-amber-500/10 text-amber-600 border-amber-500/20",
        Icon: AlertTriangle,
      };
  }
}

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function PaymentLogTable({ logs }: PaymentLogTableProps) {
  if (logs.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No payments recorded yet. Once the tenant pays rent in a required
        period, it will appear here.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground uppercase tracking-wider">
            <th className="text-left p-2">Period</th>
            <th className="text-right p-2">Amount</th>
            <th className="text-center p-2">Status</th>
            <th className="text-left p-2">Recorded</th>
            <th className="text-left p-2">Payment</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => {
            const style = statusStyle(log.status);
            return (
              <tr key={log.id} className="border-b last:border-0">
                <td className="p-2 font-mono text-xs">{log.periodKey}</td>
                <td className="p-2 text-right tabular-nums">
                  {formatCurrency(Number(log.amount))}
                </td>
                <td className="p-2 text-center">
                  <Badge variant="outline" className={style.className}>
                    <style.Icon className="h-3 w-3 mr-1" />
                    {style.label}
                  </Badge>
                </td>
                <td className="p-2 text-xs text-muted-foreground">
                  {fmtDate(log.createdAt)}
                </td>
                <td className="p-2 text-xs">
                  {log.paymentId ? (
                    <Link
                      href={`/dashboard/payments?highlight=${log.paymentId}`}
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      View <ExternalLink className="h-3 w-3" />
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

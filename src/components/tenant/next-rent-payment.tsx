import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import { CheckCircle2, CreditCard, RefreshCw, Calendar } from "lucide-react";

interface NextRentPaymentProps {
  rentAmount: number;
  dueDay: number;
  hasPaidThisMonth: boolean;
  isAutopayEnabled: boolean;
  splitPercent: number;
}

function getNextDueDate(dueDay: number, hasPaid: boolean): Date {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // Due date this month
  let dueDate = new Date(year, month, dueDay);

  // If already paid this month, show next month's due date
  if (hasPaid) {
    dueDate = new Date(year, month + 1, dueDay);
  }

  return dueDate;
}

function getDaysRemaining(dueDate: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function NextRentPayment({
  rentAmount,
  dueDay,
  hasPaidThisMonth,
  isAutopayEnabled,
  splitPercent,
}: NextRentPaymentProps) {
  const dueDate = getNextDueDate(dueDay, hasPaidThisMonth);
  const daysRemaining = getDaysRemaining(dueDate);
  const myAmount = rentAmount * splitPercent / 100;

  // Color coding
  let borderClass = "border-border";
  let bgClass = "";
  let daysColor = "text-muted-foreground";

  if (hasPaidThisMonth) {
    borderClass = "border-emerald-500/30";
    bgClass = "bg-emerald-500/5";
    daysColor = "text-emerald-600 dark:text-emerald-400";
  } else if (daysRemaining <= 0) {
    borderClass = "border-destructive/30";
    bgClass = "bg-destructive/5";
    daysColor = "text-destructive";
  } else if (daysRemaining <= 6) {
    borderClass = "border-orange-500/30";
    bgClass = "bg-orange-500/5";
    daysColor = "text-orange-600 dark:text-orange-400";
  } else if (daysRemaining <= 13) {
    borderClass = "border-amber-500/30";
    bgClass = "bg-amber-500/5";
    daysColor = "text-amber-600 dark:text-amber-400";
  }

  const formattedDue = dueDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Card className={cn("overflow-hidden", borderClass, bgClass)}>
      <CardContent className="flex items-center justify-between p-6">
        {/* Left side */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">
              {hasPaidThisMonth ? "Next Rent Payment" : "Rent Payment Due"}
            </p>
          </div>
          <p className="text-3xl font-bold tracking-tight">
            {formatCurrency(myAmount)}
            {splitPercent < 100 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({splitPercent}% split)
              </span>
            )}
          </p>
          <p className="text-sm text-muted-foreground">
            Due {formattedDue}
          </p>
          <p className={cn("text-sm font-medium", daysColor)}>
            {hasPaidThisMonth
              ? "Payment confirmed for this month"
              : daysRemaining === 0
              ? "Due today"
              : daysRemaining < 0
              ? `${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) !== 1 ? "s" : ""} overdue`
              : `${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining`}
          </p>
        </div>

        {/* Right side */}
        <div className="flex flex-col items-end gap-2">
          {hasPaidThisMonth ? (
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-8 w-8" />
              <div className="text-right">
                <p className="text-sm font-semibold">Payment</p>
                <p className="text-sm font-semibold">Confirmed</p>
              </div>
            </div>
          ) : isAutopayEnabled ? (
            <div className="flex flex-col items-end gap-2">
              <Badge
                variant="outline"
                className="bg-primary/10 text-primary border-primary/20"
              >
                <RefreshCw className="mr-1 h-3 w-3" />
                Autopay Scheduled
              </Badge>
              <Link href="/tenant/pay">
                <Button size="sm" variant="outline">
                  Pay Now Instead
                </Button>
              </Link>
            </div>
          ) : (
            <Link href="/tenant/pay">
              <Button size="lg" className="gradient-bg">
                <CreditCard className="mr-2 h-4 w-4" />
                Pay Rent
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

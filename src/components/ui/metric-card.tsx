"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { ChevronRight } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon?: React.ReactNode;
  className?: string;
  href?: string;
  onClick?: () => void;
}

function parseAnimatedValue(value: string | number) {
  if (typeof value === "number") {
    return { numeric: true, raw: value, prefix: "", suffix: "", decimals: 0 };
  }
  const str = String(value);
  // Currency: $1,234.56
  const currencyMatch = str.match(/^\$([0-9,]+(?:\.\d+)?)$/);
  if (currencyMatch) {
    const num = parseFloat(currencyMatch[1].replace(/,/g, ""));
    return { numeric: true, raw: num, prefix: "$", suffix: "", decimals: 2 };
  }
  // Percentage: 85.2%
  const pctMatch = str.match(/^([0-9,]+(?:\.\d+)?)%$/);
  if (pctMatch) {
    const num = parseFloat(pctMatch[1].replace(/,/g, ""));
    const dec = pctMatch[1].includes(".") ? pctMatch[1].split(".")[1].length : 0;
    return { numeric: true, raw: num, prefix: "", suffix: "%", decimals: dec };
  }
  // Plain number
  const plainMatch = str.match(/^([0-9,]+)$/);
  if (plainMatch) {
    const num = parseInt(plainMatch[1].replace(/,/g, ""), 10);
    return { numeric: true, raw: num, prefix: "", suffix: "", decimals: 0 };
  }
  return { numeric: false, raw: 0, prefix: "", suffix: "", decimals: 0 };
}

export function MetricCard({
  label,
  value,
  trend,
  icon,
  className,
  href,
  onClick,
}: MetricCardProps) {
  const isClickable = !!href || !!onClick;
  const parsed = parseAnimatedValue(value);

  const cardContent = (
    <Card
      className={cn(
        "border-border card-glow transition-colors",
        isClickable && "cursor-pointer hover:border-primary/30",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <div className="flex items-center gap-1.5">
            {icon && <div className="text-muted-foreground">{icon}</div>}
            {isClickable && (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            )}
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <p className="text-2xl font-bold tracking-tight">
            {parsed.numeric ? (
              <AnimatedNumber
                value={parsed.raw}
                prefix={parsed.prefix}
                suffix={parsed.suffix}
                decimals={parsed.decimals}
              />
            ) : (
              value
            )}
          </p>
          {trend && (
            <span
              className={cn(
                "text-xs font-medium",
                trend.isPositive ? "text-emerald-500" : "text-destructive"
              )}
            >
              {trend.isPositive ? "+" : ""}
              {trend.value}%
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{cardContent}</Link>;
  }

  return cardContent;
}

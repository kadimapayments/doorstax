import Link from "next/link";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";

/**
 * Large gradient-background stat card for the top row of the PM
 * dashboard. Big number, small label, optional vs-last-month delta.
 * Renders as a link when `href` is provided.
 */
export function HeroStatCard({
  label,
  value,
  href,
  delta,
  accent = "neutral",
  icon,
  footnote,
}: {
  label: string;
  value: string | number;
  href?: string;
  /** Percent change vs the previous comparable period. `null` hides the chip. */
  delta?: number | null;
  accent?: "neutral" | "success" | "warning" | "danger";
  icon?: React.ReactNode;
  footnote?: string;
}) {
  const gradient = GRADIENTS[accent];
  const borderClass = BORDERS[accent];
  const numberClass = NUMBER_CLASSES[accent];

  const body = (
    <div
      className={
        "relative overflow-hidden rounded-xl border p-5 transition-colors " +
        borderClass +
        " " +
        gradient +
        (href ? " card-hover" : "")
      }
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {icon && (
          <span className="text-muted-foreground [&>svg]:h-4 [&>svg]:w-4">
            {icon}
          </span>
        )}
      </div>
      <p className={"mt-2 text-3xl font-bold " + numberClass}>{value}</p>
      {(typeof delta === "number" || footnote) && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {typeof delta === "number" && <DeltaChip delta={delta} />}
          {footnote && <span>{footnote}</span>}
        </div>
      )}
    </div>
  );

  return href ? <Link href={href}>{body}</Link> : body;
}

function DeltaChip({ delta }: { delta: number }) {
  if (!Number.isFinite(delta)) {
    return (
      <span className="inline-flex items-center gap-0.5 text-muted-foreground">
        <Minus className="h-3 w-3" />
        no comparison
      </span>
    );
  }
  const up = delta > 0;
  const flat = Math.abs(delta) < 0.5;
  const Icon = flat ? Minus : up ? ArrowUp : ArrowDown;
  const color = flat
    ? "text-muted-foreground"
    : up
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-red-500";
  const prefix = flat ? "" : up ? "+" : "";
  return (
    <span className={"inline-flex items-center gap-0.5 font-medium " + color}>
      <Icon className="h-3 w-3" />
      {prefix}
      {delta.toFixed(1)}%
    </span>
  );
}

const GRADIENTS: Record<string, string> = {
  neutral: "bg-gradient-to-br from-card to-muted/30",
  success: "bg-gradient-to-br from-emerald-500/5 to-emerald-500/0",
  warning: "bg-gradient-to-br from-amber-500/5 to-amber-500/0",
  danger: "bg-gradient-to-br from-red-500/5 to-red-500/0",
};

const BORDERS: Record<string, string> = {
  neutral: "border-border",
  success: "border-emerald-500/20",
  warning: "border-amber-500/20",
  danger: "border-red-500/20",
};

const NUMBER_CLASSES: Record<string, string> = {
  neutral: "text-foreground",
  success: "text-foreground",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-red-600 dark:text-red-400",
};

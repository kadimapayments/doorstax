import { Badge } from "@/components/ui/badge";
import {
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type RecoveryPlanStatus =
  | "PLAN_OFFERED"
  | "PLAN_ACTIVE"
  | "PLAN_AT_RISK"
  | "PLAN_FAILED"
  | "PLAN_COMPLETED"
  | "PLAN_CANCELLED";

const STATUS_BADGE: Record<RecoveryPlanStatus, string> = {
  PLAN_OFFERED: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  PLAN_ACTIVE: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  PLAN_AT_RISK: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  PLAN_FAILED: "bg-red-500/10 text-red-600 border-red-500/20",
  PLAN_COMPLETED: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  PLAN_CANCELLED: "bg-muted text-muted-foreground border",
};

const STATUS_LABEL: Record<RecoveryPlanStatus, string> = {
  PLAN_OFFERED: "Offered",
  PLAN_ACTIVE: "Active",
  PLAN_AT_RISK: "At risk",
  PLAN_FAILED: "Failed",
  PLAN_COMPLETED: "Completed",
  PLAN_CANCELLED: "Cancelled",
};

const STATUS_ICON: Record<
  RecoveryPlanStatus,
  React.ComponentType<{ className?: string }>
> = {
  PLAN_OFFERED: Clock,
  PLAN_ACTIVE: Circle,
  PLAN_AT_RISK: AlertCircle,
  PLAN_FAILED: XCircle,
  PLAN_COMPLETED: CheckCircle2,
  PLAN_CANCELLED: XCircle,
};

export function RecoveryStatusBadge({
  status,
  size = "sm",
}: {
  status: RecoveryPlanStatus;
  size?: "sm" | "md";
}) {
  const Icon = STATUS_ICON[status];
  return (
    <Badge variant="outline" className={cn(STATUS_BADGE[status], size === "md" && "text-sm py-1 px-2")}>
      <Icon className="h-3 w-3 mr-1" />
      {STATUS_LABEL[status]}
    </Badge>
  );
}

interface RecoveryProgressBarProps {
  completed: number;
  required: number;
  status: RecoveryPlanStatus;
  /** Compact mode for inline use in tables. */
  compact?: boolean;
}

export function RecoveryProgressBar({
  completed,
  required,
  status,
  compact = false,
}: RecoveryProgressBarProps) {
  const pct = required > 0 ? Math.min(100, (completed / required) * 100) : 0;
  const barColor =
    status === "PLAN_FAILED" || status === "PLAN_CANCELLED"
      ? "bg-red-500"
      : status === "PLAN_AT_RISK"
        ? "bg-blue-500"
        : "bg-emerald-500";

  if (compact) {
    return (
      <div className="flex items-center gap-2 min-w-[120px]">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn("h-full transition-all", barColor)}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {completed}/{required}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Progress</span>
          <RecoveryStatusBadge status={status} />
        </div>
        <span className="text-sm text-muted-foreground tabular-nums">
          {completed} of {required} on-time payments
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full transition-all", barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

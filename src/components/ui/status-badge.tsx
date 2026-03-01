import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  // Payment
  COMPLETED: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
  PENDING: "bg-amber-500/15 text-amber-500 border-amber-500/20",
  FAILED: "bg-destructive/15 text-destructive border-destructive/20",
  REFUNDED: "bg-blue-500/15 text-blue-500 border-blue-500/20",
  // Unit
  AVAILABLE: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
  OCCUPIED: "bg-secondary/15 text-secondary border-secondary/20",
  // Application
  APPROVED: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
  REJECTED: "bg-destructive/15 text-destructive border-destructive/20",
  // Billing
  ACTIVE: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
  PAUSED: "bg-amber-500/15 text-amber-500 border-amber-500/20",
  CANCELLED: "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/20",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = statusStyles[status] || "bg-muted text-muted-foreground border-border";
  return (
    <Badge variant="outline" className={cn(style, "font-medium", className)}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </Badge>
  );
}

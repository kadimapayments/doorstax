import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Severity = "HIGH" | "MEDIUM" | "LOW";

const severityStyles: Record<Severity, string> = {
  HIGH: "bg-destructive/15 text-destructive border-destructive/20",
  MEDIUM: "bg-amber-500/15 text-amber-500 border-amber-500/20",
  LOW: "bg-blue-500/15 text-blue-500 border-blue-500/20",
};

interface SeverityBadgeProps {
  severity: Severity;
  className?: string;
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  return (
    <Badge variant="outline" className={cn(severityStyles[severity], "font-medium", className)}>
      {severity}
    </Badge>
  );
}

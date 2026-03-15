import { Bell } from "lucide-react";

const buckets = [
  { label: "30 Days", count: 4, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
  { label: "60 Days", count: 7, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  { label: "90 Days", count: 3, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
];

const leases = [
  { tenant: "Sarah Johnson", unit: "Maple Ridge #204", endDate: "Apr 10, 2026", days: 29, urgency: "bg-red-500/20 text-red-400" },
  { tenant: "David Park", unit: "Oak Park #115", endDate: "Apr 22, 2026", days: 41, urgency: "bg-amber-500/20 text-amber-400" },
  { tenant: "Maria Garcia", unit: "Cedar Heights #102", endDate: "May 15, 2026", days: 64, urgency: "bg-amber-500/20 text-amber-400" },
];

export function LeaseAlertsMockup() {
  return (
    <div className="rounded-lg bg-bg-card border border-border/50 p-3 space-y-2.5">
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <Bell className="h-3 w-3 text-accent-lavender" />
        <p className="text-[10px] font-semibold text-text-primary">Lease Expirations</p>
      </div>

      {/* Buckets */}
      <div className="grid grid-cols-3 gap-1.5">
        {buckets.map((b) => (
          <div key={b.label} className={`rounded-md border ${b.border} ${b.bg} px-2 py-1.5 text-center`}>
            <p className={`text-lg font-bold ${b.color}`}>{b.count}</p>
            <p className="text-[7px] text-text-muted">within {b.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-md border border-border/30 overflow-hidden">
        <div className="grid grid-cols-4 text-[7px] uppercase tracking-wider text-text-muted bg-bg-primary/40 px-2 py-1">
          <span>Tenant</span>
          <span>Unit</span>
          <span className="text-right">End Date</span>
          <span className="text-right">Days Left</span>
        </div>
        {leases.map((l) => (
          <div key={l.tenant} className="grid grid-cols-4 px-2 py-1.5 border-t border-border/20 items-center">
            <span className="text-[9px] font-medium text-text-primary truncate">{l.tenant}</span>
            <span className="text-[8px] text-text-muted truncate">{l.unit}</span>
            <span className="text-[8px] text-text-secondary text-right">{l.endDate}</span>
            <div className="flex justify-end">
              <span className={`rounded-full px-1.5 py-0.5 text-[7px] font-semibold ${l.urgency}`}>
                {l.days}d
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

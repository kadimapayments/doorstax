import {
  DollarSign,
  TrendingUp,
  Users,
  Clock,
} from "lucide-react";

const metrics = [
  { label: "Total Collected", value: "$48,250", icon: DollarSign, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  { label: "Collection Rate", value: "96.2%", icon: TrendingUp, color: "text-accent-lavender", bg: "bg-accent-purple/10" },
  { label: "Active Tenants", value: "52", icon: Users, color: "text-blue-400", bg: "bg-blue-500/10" },
  { label: "Pending", value: "3", icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10" },
];

const payments = [
  { tenant: "Sarah Johnson", unit: "Maple Ridge #204", amount: "$1,850", status: "Paid", statusColor: "bg-emerald-500/20 text-emerald-400" },
  { tenant: "Michael Chen", unit: "Oak Park #112", amount: "$2,100", status: "Processing", statusColor: "bg-blue-500/20 text-blue-400" },
  { tenant: "Emily Davis", unit: "Cedar Heights #305", amount: "$1,650", status: "Pending", statusColor: "bg-amber-500/20 text-amber-400" },
];

const barHeights = [65, 72, 58, 80, 90, 75, 85, 92, 78, 88, 95, 70];
const months = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

export function DashboardMockup() {
  return (
    <div className="space-y-3">
      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-lg bg-bg-card border border-border/50 p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className={`flex h-6 w-6 items-center justify-center rounded-md ${m.bg}`}>
                <m.icon className={`h-3 w-3 ${m.color}`} />
              </div>
              <span className="text-[9px] text-text-muted uppercase tracking-wider">{m.label}</span>
            </div>
            <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Bar chart + table row */}
      <div className="grid grid-cols-2 gap-2">
        {/* Chart */}
        <div className="rounded-lg bg-bg-card border border-border/50 p-3">
          <p className="text-[9px] text-text-muted uppercase tracking-wider mb-2">Monthly Collection</p>
          <div className="flex items-end gap-1" style={{ height: 64 }}>
            {barHeights.map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                <div
                  className="w-full rounded-sm bg-accent-lavender/40"
                  style={{ height: `${h}%` }}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-1 mt-1">
            {months.map((m, i) => (
              <span key={i} className="flex-1 text-center text-[7px] text-text-muted">{m}</span>
            ))}
          </div>
        </div>

        {/* Recent Payments table */}
        <div className="rounded-lg bg-bg-card border border-border/50 p-3">
          <p className="text-[9px] text-text-muted uppercase tracking-wider mb-2">Recent Payments</p>
          <div className="space-y-1.5">
            {payments.map((p) => (
              <div key={p.tenant} className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-text-primary truncate">{p.tenant}</p>
                  <p className="text-[8px] text-text-muted truncate">{p.unit}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-[10px] font-semibold text-text-primary">{p.amount}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[7px] font-semibold ${p.statusColor}`}>
                    {p.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const buckets = [
  { label: "Current", count: 3, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  { label: "30+ Days", count: 2, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  { label: "60+ Days", count: 1, color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
  { label: "90+ Days", count: 0, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
];

const rows = [
  { tenant: "James Wilson", unit: "Oak Park #301", balance: "$3,700", aging: "34 days", agingColor: "bg-amber-500/20 text-amber-400" },
  { tenant: "Lisa Brown", unit: "Maple Ridge #108", balance: "$1,850", aging: "12 days", agingColor: "bg-emerald-500/20 text-emerald-400" },
  { tenant: "Robert Kim", unit: "Cedar Heights #210", balance: "$2,100", aging: "5 days", agingColor: "bg-emerald-500/20 text-emerald-400" },
];

export function UnpaidRentMockup() {
  return (
    <div className="rounded-lg bg-bg-card border border-border/50 p-3 space-y-2.5">
      {/* Aging buckets */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {buckets.map((b) => (
          <div key={b.label} className={`rounded-md border ${b.border} ${b.bg} px-2 py-1.5 text-center`}>
            <p className={`text-lg font-bold ${b.color}`}>{b.count}</p>
            <p className="text-[7px] text-text-muted">{b.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-md border border-border/30 overflow-hidden">
        <div className="grid grid-cols-4 text-[7px] uppercase tracking-wider text-text-muted bg-bg-primary/40 px-2 py-1">
          <span>Tenant</span>
          <span>Unit</span>
          <span className="text-right">Balance</span>
          <span className="text-right">Aging</span>
        </div>
        {rows.map((r) => (
          <div key={r.tenant} className="grid grid-cols-4 px-2 py-1.5 border-t border-border/20 items-center">
            <span className="text-[9px] font-medium text-text-primary truncate">{r.tenant}</span>
            <span className="text-[8px] text-text-muted truncate">{r.unit}</span>
            <span className="text-[9px] font-semibold text-text-primary text-right">{r.balance}</span>
            <div className="flex justify-end">
              <span className={`rounded-full px-1.5 py-0.5 text-[7px] font-semibold ${r.agingColor}`}>
                {r.aging}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

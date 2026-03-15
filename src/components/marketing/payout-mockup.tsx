import { FileText } from "lucide-react";

const lineItems = [
  { property: "Maple Ridge Apartments", units: 12, gross: "$22,200", fees: "$1,110", net: "$21,090" },
  { property: "Oak Park Residences", units: 8, gross: "$16,800", fees: "$840", net: "$15,960" },
  { property: "Cedar Heights", units: 6, gross: "$9,900", fees: "$495", net: "$9,405" },
];

export function PayoutMockup() {
  return (
    <div className="rounded-lg bg-bg-card border border-border/50 p-3 space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold text-text-primary">Owner Statement</p>
          <p className="text-[8px] text-text-muted">March 2026 — John Robertson</p>
        </div>
        <div className="flex items-center gap-1 rounded-md bg-accent-purple/10 px-2 py-1">
          <FileText className="h-2.5 w-2.5 text-accent-lavender" />
          <span className="text-[7px] font-medium text-accent-lavender">PDF</span>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        <div className="rounded-md bg-bg-primary/60 px-2 py-1.5 text-center">
          <p className="text-[7px] text-text-muted">Gross Rent</p>
          <p className="text-[10px] font-bold text-text-primary">$48,900</p>
        </div>
        <div className="rounded-md bg-bg-primary/60 px-2 py-1.5 text-center">
          <p className="text-[7px] text-text-muted">Mgmt Fee</p>
          <p className="text-[10px] font-bold text-red-400">-$2,445</p>
        </div>
        <div className="rounded-md bg-bg-primary/60 px-2 py-1.5 text-center">
          <p className="text-[7px] text-text-muted">Expenses</p>
          <p className="text-[10px] font-bold text-red-400">-$920</p>
        </div>
        <div className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-1.5 text-center">
          <p className="text-[7px] text-emerald-400/70">Net Payout</p>
          <p className="text-[10px] font-bold text-emerald-400">$45,535</p>
        </div>
      </div>

      {/* Line items */}
      <div className="rounded-md border border-border/30 overflow-hidden">
        <div className="grid grid-cols-5 text-[7px] uppercase tracking-wider text-text-muted bg-bg-primary/40 px-2 py-1">
          <span className="col-span-2">Property</span>
          <span className="text-right">Gross</span>
          <span className="text-right">Fees</span>
          <span className="text-right">Net</span>
        </div>
        {lineItems.map((r) => (
          <div key={r.property} className="grid grid-cols-5 px-2 py-1.5 border-t border-border/20">
            <div className="col-span-2 min-w-0">
              <p className="text-[8px] font-medium text-text-primary truncate">{r.property}</p>
              <p className="text-[7px] text-text-muted">{r.units} units</p>
            </div>
            <span className="text-[8px] text-text-secondary text-right">{r.gross}</span>
            <span className="text-[8px] text-red-400/70 text-right">{r.fees}</span>
            <span className="text-[8px] font-semibold text-emerald-400 text-right">{r.net}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

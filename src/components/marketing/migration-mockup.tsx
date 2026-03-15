import { Upload, CheckCircle2 } from "lucide-react";

const platforms = [
  { name: "Buildium", active: false },
  { name: "AppFolio", active: true },
  { name: "Yardi", active: false },
  { name: "Rent Manager", active: false },
  { name: "Custom CSV", active: false },
];

export function MigrationMockup() {
  return (
    <div className="rounded-lg bg-bg-card border border-border/50 p-3 space-y-3">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2">
        {["Choose Platform", "Upload & Map", "Import"].map((step, i) => (
          <div key={step} className="flex items-center gap-1.5">
            <div
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold ${
                i === 0
                  ? "bg-emerald-500 text-white"
                  : i === 1
                  ? "bg-accent-purple text-white"
                  : "bg-bg-primary text-text-muted border border-border"
              }`}
            >
              {i === 0 ? "✓" : i + 1}
            </div>
            <span className={`text-[8px] font-medium ${i === 1 ? "text-text-primary" : "text-text-muted"}`}>
              {step}
            </span>
            {i < 2 && <div className="h-px w-4 bg-border" />}
          </div>
        ))}
      </div>

      {/* Platform cards */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
        {platforms.map((p) => (
          <div
            key={p.name}
            className={`rounded-md border px-2 py-1.5 text-center text-[8px] font-medium transition-colors ${
              p.active
                ? "border-accent-lavender bg-accent-purple/10 text-accent-lavender"
                : "border-border/50 bg-bg-primary/40 text-text-muted"
            }`}
          >
            {p.name}
          </div>
        ))}
      </div>

      {/* Upload zone */}
      <div className="rounded-lg border-2 border-dashed border-border/50 bg-bg-primary/30 py-4 flex flex-col items-center gap-1.5">
        <Upload className="h-4 w-4 text-text-muted" />
        <p className="text-[9px] text-text-muted">Drop CSV here or click to browse</p>
        <p className="text-[7px] text-text-muted/60">appfolio-export-2026.csv</p>
      </div>

      {/* Result banner */}
      <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 flex items-center gap-2">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
        <div>
          <p className="text-[10px] font-semibold text-emerald-400">Ready to import</p>
          <p className="text-[8px] text-emerald-400/70">45 properties, 312 units found — 13 columns auto-mapped</p>
        </div>
      </div>
    </div>
  );
}

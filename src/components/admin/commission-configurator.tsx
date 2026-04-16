"use client";

import { AGENT_KICKBACK_RATES } from "@/lib/residual-tiers";

export interface CommissionFormState {
  commissionEnabled: boolean;
  commissionMode: "TIER_DEFAULT" | "CUSTOM_TIER";
  customTierRates: Record<string, number>;
}

export const DEFAULT_COMMISSION_STATE: CommissionFormState = {
  commissionEnabled: true,
  commissionMode: "TIER_DEFAULT",
  customTierRates: { ...AGENT_KICKBACK_RATES },
};

const TIERS: Array<{ name: keyof typeof AGENT_KICKBACK_RATES | string; label: string; units: string }> = [
  { name: "Starter", label: "Starter", units: "0–99 units" },
  { name: "Growth", label: "Growth", units: "100–499 units" },
  { name: "Scale", label: "Scale", units: "500–999 units" },
  { name: "Enterprise", label: "Enterprise", units: "1,000+ units" },
];

interface Props {
  value: CommissionFormState;
  onChange: (next: CommissionFormState) => void;
}

export function CommissionConfigurator({ value, onChange }: Props) {
  function setField<K extends keyof CommissionFormState>(
    field: K,
    v: CommissionFormState[K]
  ) {
    onChange({ ...value, [field]: v });
  }

  function setRate(tier: string, raw: string) {
    const num = Number(raw);
    onChange({
      ...value,
      customTierRates: {
        ...value.customTierRates,
        [tier]: Number.isFinite(num) && num >= 0 ? num : 0,
      },
    });
  }

  return (
    <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
      {/* Enable toggle */}
      <label className="flex items-center justify-between cursor-pointer">
        <div>
          <p className="text-sm font-semibold">Enable commissions for this agent</p>
          <p className="text-xs text-muted-foreground">
            When off, the agent is tracked as a referrer but earns $0 on payouts.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={value.commissionEnabled}
          onClick={() => setField("commissionEnabled", !value.commissionEnabled)}
          className={
            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors " +
            (value.commissionEnabled ? "bg-primary" : "bg-muted")
          }
        >
          <span
            className={
              "inline-block h-4 w-4 transform rounded-full bg-white transition-transform " +
              (value.commissionEnabled ? "translate-x-4" : "translate-x-0.5")
            }
          />
        </button>
      </label>

      {value.commissionEnabled ? (
        <>
          {/* Mode selector */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setField("commissionMode", "TIER_DEFAULT")}
              className={
                "flex-1 rounded-lg border px-3 py-2 text-xs text-left " +
                (value.commissionMode === "TIER_DEFAULT"
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted")
              }
            >
              <p className="font-medium">Standard tier rates</p>
              <p className="text-muted-foreground mt-0.5">
                $2.50 / $2.00 / $1.50 / $1.00 per unit
              </p>
            </button>
            <button
              type="button"
              onClick={() => setField("commissionMode", "CUSTOM_TIER")}
              className={
                "flex-1 rounded-lg border px-3 py-2 text-xs text-left " +
                (value.commissionMode === "CUSTOM_TIER"
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted")
              }
            >
              <p className="font-medium">Custom tier rates</p>
              <p className="text-muted-foreground mt-0.5">
                Override the defaults
              </p>
            </button>
          </div>

          {/* Rate table */}
          <div className="grid grid-cols-4 gap-2">
            {TIERS.map((t) => (
              <div key={t.name} className="text-center p-2 rounded bg-background border">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {t.label}
                </p>
                <p className="text-[9px] text-muted-foreground">{t.units}</p>
                {value.commissionMode === "CUSTOM_TIER" ? (
                  <div className="flex items-center justify-center gap-0.5 mt-1">
                    <span className="text-sm font-semibold">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={value.customTierRates[t.name] ?? 0}
                      onChange={(e) => setRate(String(t.name), e.target.value)}
                      className="w-14 text-sm font-bold text-center bg-transparent border-b border-primary/40 focus:outline-none focus:border-primary"
                    />
                  </div>
                ) : (
                  <p className="text-sm font-bold mt-1">
                    ${(AGENT_KICKBACK_RATES[t.name] ?? 0).toFixed(2)}
                  </p>
                )}
              </div>
            ))}
          </div>

          <p className="text-[10px] text-muted-foreground">
            Only units with a completed payment in the period count toward the kickback.
          </p>
        </>
      ) : (
        <p className="text-xs text-muted-foreground italic">
          This agent will be tracked as a referring agent but won&apos;t earn monthly payouts.
        </p>
      )}
    </div>
  );
}

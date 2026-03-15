import { Check } from "lucide-react";

const steps = [
  { label: "Personal", done: true },
  { label: "Payment", done: true },
  { label: "Roommates", done: true },
  { label: "Checklist", active: true },
  { label: "Documents", done: false },
  { label: "Lease", done: false },
  { label: "Complete", done: false },
];

const checklistItems = [
  { area: "Kitchen", item: "Stove and oven functional", checked: true },
  { area: "Kitchen", item: "Refrigerator working", checked: true },
  { area: "Bathroom", item: "Hot water running", checked: false },
  { area: "Bathroom", item: "Toilet flushing properly", checked: false },
  { area: "Living Room", item: "Windows open/close", checked: false },
];

export function OnboardingMockup() {
  return (
    <div className="rounded-lg bg-bg-card border border-border/50 p-3 space-y-3">
      {/* Step indicator */}
      <div className="flex items-center justify-between px-1 overflow-x-auto">
        {steps.map((s, i) => (
          <div key={s.label} className="flex items-center gap-0">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[7px] font-bold ${
                  s.done
                    ? "bg-emerald-500 text-white"
                    : s.active
                    ? "bg-accent-purple text-white"
                    : "bg-bg-primary border border-border text-text-muted"
                }`}
              >
                {s.done ? <Check className="h-2.5 w-2.5" /> : i + 1}
              </div>
              <span className={`mt-0.5 text-[6px] ${s.active ? "text-accent-lavender font-semibold" : "text-text-muted"}`}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`h-px w-3 mx-0.5 ${
                  s.done ? "bg-emerald-500" : "bg-border"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Checklist content */}
      <div className="rounded-md border border-border/30 bg-bg-primary/30 p-2.5 space-y-1.5">
        <p className="text-[9px] font-semibold text-text-primary">Move-In Checklist</p>
        {checklistItems.map((item) => (
          <div key={item.item} className="flex items-center gap-2">
            <div
              className={`flex h-3.5 w-3.5 items-center justify-center rounded border ${
                item.checked
                  ? "bg-emerald-500 border-emerald-500"
                  : "border-border bg-bg-primary"
              }`}
            >
              {item.checked && <Check className="h-2 w-2 text-white" />}
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[7px] text-accent-lavender font-medium shrink-0">{item.area}</span>
              <span className={`text-[8px] ${item.checked ? "text-text-muted line-through" : "text-text-secondary"}`}>
                {item.item}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

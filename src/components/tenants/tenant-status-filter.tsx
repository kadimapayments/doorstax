"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StatusTab = "ALL" | "ACTIVE" | "PROSPECT" | "PREVIOUS";

const tabs: { label: string; value: StatusTab }[] = [
  { label: "All", value: "ALL" },
  { label: "Active", value: "ACTIVE" },
  { label: "Prospects", value: "PROSPECT" },
  { label: "Previous", value: "PREVIOUS" },
];

interface TenantStatusFilterProps {
  current: string;
  counts: Record<string, number>;
}

export function TenantStatusFilter({ current, counts }: TenantStatusFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleTabClick(value: StatusTab) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "ALL") {
      params.delete("status");
    } else {
      params.set("status", value);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex gap-1 rounded-lg bg-muted p-1">
      {tabs.map((tab) => {
        const isActive =
          tab.value === "ALL" ? !current : current === tab.value;
        const count = tab.value === "ALL" ? counts.ALL : (counts[tab.value] ?? 0);

        return (
          <Button
            key={tab.value}
            variant="ghost"
            size="sm"
            onClick={() => handleTabClick(tab.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            <span
              className={cn(
                "ml-1.5 rounded-full px-1.5 py-0.5 text-xs",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "bg-muted-foreground/10 text-muted-foreground"
              )}
            >
              {count}
            </span>
          </Button>
        );
      })}
    </div>
  );
}

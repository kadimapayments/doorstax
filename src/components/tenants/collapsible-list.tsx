"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  items: React.ReactNode[];
  initialCount?: number;
  label?: string;
}

export function CollapsibleList({ items, initialCount = 10, label = "items" }: Props) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, initialCount);
  const hasMore = items.length > initialCount;

  return (
    <div>
      {visible}
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-2 text-xs text-primary hover:underline flex items-center justify-center gap-1 mt-1"
        >
          {expanded ? (
            <>Show Less <ChevronUp className="h-3 w-3" /></>
          ) : (
            <>Show {items.length - initialCount} More {label} <ChevronDown className="h-3 w-3" /></>
          )}
        </button>
      )}
    </div>
  );
}

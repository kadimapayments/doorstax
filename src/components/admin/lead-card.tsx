"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { formatPhoneNumber } from "@/components/ui/phone-input";
import { Building2, Phone, User } from "lucide-react";

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  companyName: string;
  buildings: number;
  units: number;
  status: string;
  source: string;
  assignedToId: string | null;
  assignedTo: { id: string; name: string } | null;
  customFields: Record<string, string>;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  activities?: Activity[];
}

export interface Activity {
  id: string;
  type: string;
  content: string;
  userId: string | null;
  userName: string | null;
  createdAt: string;
}

export interface StaffUser {
  id: string;
  name: string;
  email: string;
}

const sourceLabels: Record<string, string> = {
  WEBSITE: "Website",
  REFERRAL: "Referral",
  AGENT: "Agent",
  MANUAL: "Manual",
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMo = Math.floor(diffDay / 30);
  return `${diffMo}mo ago`;
}

interface LeadCardProps {
  lead: Lead;
  onClick: (lead: Lead) => void;
}

export function LeadCard({ lead, onClick }: LeadCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.stopPropagation();
        onClick(lead);
      }}
      className={cn(
        "cursor-pointer rounded-lg border border-border bg-background p-3 shadow-sm transition-all hover:border-primary/30 hover:shadow-md",
        isDragging && "opacity-50 shadow-lg ring-2 ring-primary/20"
      )}
    >
      {/* Header: Name + Age */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold truncate">{lead.name}</p>
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {timeAgo(lead.createdAt)}
        </span>
      </div>

      {/* Company */}
      {lead.companyName && (
        <p className="mt-0.5 text-xs text-muted-foreground truncate">
          {lead.companyName}
        </p>
      )}

      {/* Phone */}
      {lead.phone && (
        <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
          <Phone className="h-3 w-3" />
          <span>{formatPhoneNumber(lead.phone)}</span>
        </div>
      )}

      {/* Buildings / Units */}
      {(lead.buildings > 0 || lead.units > 0) && (
        <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
          <Building2 className="h-3 w-3" />
          <span>
            B: {lead.buildings} / U: {lead.units}
          </span>
        </div>
      )}

      {/* Footer: Avatar + Source */}
      <div className="mt-2 flex items-center justify-between">
        {lead.assignedTo ? (
          <div
            className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary"
            title={lead.assignedTo.name}
          >
            {lead.assignedTo.name.charAt(0).toUpperCase()}
          </div>
        ) : (
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground">
            <User className="h-3 w-3" />
          </div>
        )}
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {sourceLabels[lead.source] || lead.source}
        </span>
      </div>
    </div>
  );
}

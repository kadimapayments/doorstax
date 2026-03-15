"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { LeadCard, type Lead } from "./lead-card";

const STATUSES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "APPLIED",
  "UNDERWRITING",
  "ONBOARDING",
  "CONVERTED",
  "LOST",
] as const;

const statusConfig: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  NEW: { label: "New", color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  CONTACTED: { label: "Contacted", color: "text-indigo-500", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
  QUALIFIED: { label: "Qualified", color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/20" },
  APPLIED: { label: "Applied", color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  UNDERWRITING: { label: "Underwriting", color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20" },
  ONBOARDING: { label: "Onboarding", color: "text-cyan-500", bg: "bg-cyan-500/10", border: "border-cyan-500/20" },
  CONVERTED: { label: "Converted", color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  LOST: { label: "Lost", color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20" },
};

interface KanbanColumnProps {
  status: string;
  leads: Lead[];
  onCardClick: (lead: Lead) => void;
}

function KanbanColumn({ status, leads, onCardClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const cfg = statusConfig[status];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-[280px] shrink-0 flex-col rounded-lg border border-border bg-muted/30",
        isOver && "ring-2 ring-primary/30"
      )}
    >
      {/* Column Header */}
      <div className={cn("flex items-center justify-between rounded-t-lg border-b border-border px-3 py-2", cfg.bg)}>
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-semibold", cfg.color)}>
            {cfg.label}
          </span>
        </div>
        <span
          className={cn(
            "flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
            cfg.bg,
            cfg.color
          )}
        >
          {leads.length}
        </span>
      </div>

      {/* Cards */}
      <SortableContext
        items={leads.map((l) => l.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2" style={{ minHeight: 120, maxHeight: "calc(100vh - 320px)" }}>
          {leads.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-border p-4">
              <p className="text-xs text-muted-foreground">No leads</p>
            </div>
          ) : (
            leads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} onClick={onCardClick} />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

interface LeadsKanbanProps {
  leads: Lead[];
  onLeadUpdate: (lead: Lead) => void;
  onCardClick: (lead: Lead) => void;
}

export function LeadsKanban({ leads, onLeadUpdate, onCardClick }: LeadsKanbanProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const leadId = String(active.id);
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;

    // Determine which column was dropped on
    let newStatus: string | null = null;

    // If dropped over a column directly (the droppable id is the status)
    if (STATUSES.includes(over.id as (typeof STATUSES)[number])) {
      newStatus = String(over.id);
    } else {
      // Dropped over another card - find the card's status
      const targetLead = leads.find((l) => l.id === String(over.id));
      if (targetLead) newStatus = targetLead.status;
    }

    if (!newStatus || newStatus === lead.status) return;

    // Optimistic update
    const updated = { ...lead, status: newStatus };
    onLeadUpdate(updated);

    try {
      const res = await fetch(`/api/admin/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      toast.success(`Lead moved to ${statusConfig[newStatus]?.label || newStatus}`);
    } catch {
      // Revert
      onLeadUpdate(lead);
      toast.error("Failed to update lead status");
    }
  }

  // Group leads by status
  const grouped = STATUSES.reduce<Record<string, Lead[]>>((acc, status) => {
    acc[status] = leads.filter((l) => l.status === status);
    return acc;
  }, {} as Record<string, Lead[]>);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            leads={grouped[status]}
            onCardClick={onCardClick}
          />
        ))}
      </div>

      <DragOverlay>
        {activeLead ? (
          <div className="w-[264px] rotate-2 opacity-90">
            <LeadCard lead={activeLead} onClick={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, ChevronRight, ChevronUp, Home, Building2, Landmark, Store, Pencil, Trash2 } from "lucide-react";
import type { PropertyData } from "./property-search";
import { cn } from "@/lib/utils";
import { showConfirm } from "@/components/admin/dialog-prompt";

const propertyTypeConfig: Record<string, { label: string; icon: typeof Home }> = {
  SINGLE_FAMILY: { label: "Single Family", icon: Home },
  MULTIFAMILY: { label: "Multifamily", icon: Building2 },
  OFFICE: { label: "Office", icon: Landmark },
  COMMERCIAL: { label: "Commercial", icon: Store },
};

/* ── Count Badge ─────────────────────────────────────────── */
function CountBadge({ count }: { count: number }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-purple-700 text-white font-bold text-sm shadow-md">
      {count}
    </div>
  );
}

/* ── Motivational Copy ───────────────────────────────────── */
function getMotivation(count: number): string {
  if (count >= 10) return "Massive stack! You're a portfolio powerhouse.";
  if (count >= 5) return "Growing strong — keep stacking doors!";
  if (count >= 1) return "Every empire starts with a single door.";
  return "";
}

/* ── Main Component ──────────────────────────────────────── */
interface PropertyStackProps {
  properties: PropertyData[];
  stackIndex: number;
  stackTotal: number;
  // Editable stack props (only present for DB-backed stacks)
  stackId?: string;
  stackName?: string;
  allStacks?: { id: string; name: string }[];
  onMoveProperty?: (propertyId: string, targetStackId: string) => void;
  onRenameStack?: (stackId: string, newName: string) => void;
  onDeleteStack?: (stackId: string) => void;
  onReorderStack?: (stackId: string, direction: "up" | "down") => void;
}

export function PropertyStack({
  properties,
  stackIndex,
  stackTotal,
  stackId,
  stackName,
  allStacks,
  onMoveProperty,
  onRenameStack,
  onDeleteStack,
  onReorderStack,
}: PropertyStackProps) {
  const [expanded, setExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(stackName || "");
  const inputRef = useRef<HTMLInputElement>(null);

  const isLastStack = stackIndex === stackTotal - 1;
  const stackNumber = stackIndex + 1;
  const displayName = stackName || `Stack ${stackNumber}`;
  const isCustomStack = !!stackId;

  // Doors = units, not properties
  const totalDoors = properties.reduce((sum, p) => sum + p.units.length, 0);
  const totalOccupied = properties.reduce(
    (sum, p) => sum + p.units.filter((u) => u.status === "OCCUPIED").length,
    0
  );
  const totalRent = properties.reduce(
    (sum, p) => sum + p.units.reduce((s, u) => s + u.rentAmount, 0),
    0
  );

  const topProperty = properties[0];

  const topTypeInfo = topProperty
    ? propertyTypeConfig[topProperty.propertyType] || propertyTypeConfig.MULTIFAMILY
    : propertyTypeConfig.MULTIFAMILY;
  const TopIcon = topTypeInfo.icon;
  const topOccupied = topProperty ? topProperty.units.filter((u) => u.status === "OCCUPIED").length : 0;
  const topTotal = topProperty ? topProperty.units.length : 0;
  const topRent = topProperty ? topProperty.units.reduce((sum, u) => sum + u.rentAmount, 0) : 0;
  const isEmpty = properties.length === 0;

  function handleStartEditing() {
    if (!isCustomStack) return;
    setEditName(stackName || `Stack ${stackNumber}`);
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleFinishEditing() {
    setIsEditing(false);
    const trimmed = editName.trim();
    if (trimmed && trimmed !== stackName && stackId) {
      onRenameStack?.(stackId, trimmed);
    }
  }

  return (
    <Card className="border-border card-glow overflow-hidden animate-fade-in-up">
      <CardContent className="p-5">
        {/* ── Stack Header ─────────────────────────── */}
        <div className="flex items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-3 min-w-0">
            <CountBadge count={properties.length} />
            <div className="min-w-0">
              {isEditing ? (
                <Input
                  ref={inputRef}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={handleFinishEditing}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleFinishEditing();
                    if (e.key === "Escape") setIsEditing(false);
                  }}
                  className="h-7 text-base font-bold w-40"
                />
              ) : (
                <div className="flex items-center gap-1.5">
                  <h3
                    className={cn(
                      "font-bold text-base truncate",
                      isCustomStack && "cursor-pointer hover:text-primary transition-colors"
                    )}
                    onClick={handleStartEditing}
                  >
                    {displayName}
                  </h3>
                  {isCustomStack && (
                    <button
                      onClick={handleStartEditing}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      title="Rename stack"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {properties.length} propert{properties.length !== 1 ? "ies" : "y"}
              </p>
            </div>
          </div>
          {isCustomStack && (
            <div className="flex items-center gap-0.5 shrink-0">
              {onReorderStack && (
                <>
                  <button
                    onClick={() => onReorderStack(stackId!, "up")}
                    disabled={stackIndex === 0}
                    className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Move stack up"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => onReorderStack(stackId!, "down")}
                    disabled={isLastStack}
                    className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Move stack down"
                  >
                    <ChevronRight className="h-3.5 w-3.5 rotate-90" />
                  </button>
                </>
              )}
              {onDeleteStack && (
                <button
                  onClick={async () => {
                    if (await showConfirm({ title: "Delete Stack?", description: "This will delete the stack. All properties currently in it will become unassigned.", confirmLabel: "Delete Stack", destructive: true })) {
                      onDeleteStack(stackId!);
                    }
                  }}
                  className="rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
                  title="Delete stack"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Stats row */}
        {!isEmpty && (
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-muted-foreground mb-4">
            <span>{totalDoors} Door{totalDoors !== 1 ? "s" : ""}</span>
            <span>{totalOccupied} occupied</span>
            <span>${totalRent.toLocaleString()}/mo</span>
          </div>
        )}

        {/* ── Empty State ──────────────────────────── */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Building2 className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No properties in this stack yet.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Expand another stack and use &quot;Move to...&quot; to add properties here.
            </p>
          </div>
        )}

        {/* ── Collapsed: Stacked Card Visual ──────── */}
        {!isEmpty && !expanded && (
          <>
            <div
              className="relative cursor-pointer group"
              style={{ height: 160 + (Math.min(properties.length, 5) - 1) * 8 }}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              onClick={() => setExpanded(true)}
              role="button"
              aria-label={`Expand ${displayName}`}
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setExpanded(true)}
            >
              {properties.slice(0, 5).map((property, index) => {
                const depth = Math.min(properties.length, 5) - 1 - index;
                const isTop = depth === 0;
                const typeInfo = propertyTypeConfig[property.propertyType] || propertyTypeConfig.MULTIFAMILY;
                const TypeIcon = typeInfo.icon;

                const xOffset = depth * (isHovered ? 8 : 5);
                const yOffset = depth * (isHovered ? 12 : 8);
                const rotation = depth * (isHovered ? -1 : -0.6);
                const scale = 1 - depth * 0.025;
                const dimming = 1 - depth * 0.06;

                return (
                  <div
                    key={property.id}
                    className="absolute inset-0 transition-all duration-300 ease-out"
                    style={{
                      transform: `translateX(${xOffset}px) translateY(${yOffset}px) rotate(${rotation}deg) scale(${scale})`,
                      zIndex: 5 - depth,
                    }}
                  >
                    <Card
                      className={cn(
                        "h-full border-border transition-colors",
                        isTop && "hover:border-border-hover"
                      )}
                      style={{
                        filter: depth > 0 ? `brightness(${dimming})` : undefined,
                        boxShadow: `0 ${4 + depth * 3}px ${10 + depth * 6}px rgba(0,0,0,${0.06 + depth * 0.04})`,
                      }}
                    >
                      <CardContent className="p-4">
                        {isTop ? (
                          <>
                            <div className="flex items-center gap-2">
                              <TopIcon className="h-4 w-4 text-muted-foreground" />
                              <span className="font-semibold text-sm truncate">{topProperty.name}</span>
                            </div>
                            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground truncate">
                              <MapPin className="h-3 w-3 shrink-0" />
                              {topProperty.address}, {topProperty.city}, {topProperty.state}
                            </p>
                            <div className="mt-3 flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">
                                {topTotal} unit{topTotal !== 1 ? "s" : ""}
                              </span>
                              <StatusBadge
                                status={topTotal === 0 ? "EMPTY" : topOccupied === topTotal ? "OCCUPIED" : "AVAILABLE"}
                              />
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {topOccupied}/{topTotal} occupied &middot; ${topRent.toLocaleString()}/mo
                            </p>
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                            <TypeIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs font-medium truncate">{property.name}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
              {properties.length > 5 && (
                <div className="absolute bottom-2 right-2 z-10 rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground shadow-md">
                  +{properties.length - 5} more
                </div>
              )}
            </div>

            {/* Motivation + CTA */}
            <p className="text-xs text-muted-foreground italic mt-3 text-center">
              {getMotivation(properties.length)}
            </p>
            <div className="mt-3 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpanded(true)}
                className="border-purple-400 text-purple-700 hover:bg-purple-50 dark:border-purple-500 dark:text-purple-300 dark:hover:bg-purple-950 font-semibold"
              >
                View Stack
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          </>
        )}

        {/* ── Expanded: Property List ─────────────── */}
        {!isEmpty && expanded && (
          <>
            <div className="space-y-2 animate-unstack">
              {properties.map((property) => {
                const typeInfo = propertyTypeConfig[property.propertyType] || propertyTypeConfig.MULTIFAMILY;
                const TypeIcon = typeInfo.icon;
                const occupied = property.units.filter((u) => u.status === "OCCUPIED").length;
                const total = property.units.length;
                const rent = property.units.reduce((sum, u) => sum + u.rentAmount, 0);

                return (
                  <Card key={property.id} className="border-border transition-colors hover:border-border-hover">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/dashboard/properties/${property.id}`} className="flex items-center gap-2 min-w-0 flex-1">
                          <TypeIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{property.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {property.address}, {property.city}
                            </p>
                          </div>
                        </Link>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <p className="text-xs font-medium">{total}u &middot; ${rent.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">{occupied}/{total} occ</p>
                          </div>
                          {/* Move to Stack dropdown — available on all stacks when custom stacks exist */}
                          {allStacks && allStacks.length > 0 && (
                            <select
                              value=""
                              onChange={(e) => {
                                if (e.target.value) onMoveProperty?.(property.id, e.target.value);
                              }}
                              className="h-7 rounded border border-input bg-background px-1.5 text-[10px] w-20"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value="">Move to...</option>
                              {allStacks
                                .filter((s) => {
                                  // Exclude current stack
                                  if (s.id === stackId) return false;
                                  // If we're in Unassigned, hide the "Unassigned" option
                                  if (!isCustomStack && s.id === "__unassigned__") return false;
                                  return true;
                                })
                                .map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name || `Stack`}
                                  </option>
                                ))}
                            </select>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Motivation + Collapse */}
            <p className="text-xs text-muted-foreground italic mt-3 text-center">
              {getMotivation(properties.length)}
            </p>
            <div className="mt-3 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpanded(false)}
                className="border-purple-400 text-purple-700 hover:bg-purple-50 dark:border-purple-500 dark:text-purple-300 dark:hover:bg-purple-950 font-semibold"
              >
                Collapse
                <ChevronUp className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

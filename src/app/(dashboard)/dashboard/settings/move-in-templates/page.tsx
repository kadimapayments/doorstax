"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Star, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ChecklistItem {
  area: string;
  item: string;
  condition: string;
  notes?: string;
}

interface Template {
  id: string;
  name: string;
  items: ChecklistItem[];
  isDefault: boolean;
}

const DEFAULT_AREAS = [
  "Kitchen",
  "Bathroom",
  "Bedroom",
  "Living Room",
  "Hallway",
  "Entrance",
  "Laundry",
  "Garage",
  "Patio/Balcony",
];

const DEFAULT_ITEMS: Record<string, string[]> = {
  Kitchen: ["Walls", "Floors", "Countertops", "Cabinets", "Sink", "Appliances"],
  Bathroom: ["Walls", "Floors", "Toilet", "Shower/Tub", "Sink", "Mirror"],
  Bedroom: ["Walls", "Floors", "Windows", "Closet", "Door"],
  "Living Room": ["Walls", "Floors", "Windows", "Electrical Outlets"],
  Hallway: ["Walls", "Floors", "Lighting"],
  Entrance: ["Door", "Lock", "Doorbell", "Lighting"],
  Laundry: ["Washer Connection", "Dryer Connection", "Flooring"],
  Garage: ["Door", "Floors", "Lighting"],
  "Patio/Balcony": ["Railing", "Flooring", "Lighting"],
};

export default function MoveInTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editing state
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editItems, setEditItems] = useState<ChecklistItem[]>([]);
  const [editDefault, setEditDefault] = useState(false);

  function fetchTemplates() {
    fetch("/api/tenants/move-in-templates")
      .then((r) => r.json())
      .then((data) => {
        setTemplates(data);
        setLoading(false);
      });
  }

  useEffect(() => {
    fetchTemplates();
  }, []);

  function startNew() {
    setEditId("new");
    setEditName("Default Move-In Checklist");
    setEditDefault(templates.length === 0);
    // Pre-populate with common items
    const items: ChecklistItem[] = [];
    for (const area of ["Kitchen", "Bathroom", "Bedroom", "Living Room", "Entrance"]) {
      for (const item of DEFAULT_ITEMS[area] || []) {
        items.push({ area, item, condition: "GOOD" });
      }
    }
    setEditItems(items);
  }

  function startEdit(t: Template) {
    setEditId(t.id);
    setEditName(t.name);
    setEditItems([...(t.items as ChecklistItem[])]);
    setEditDefault(t.isDefault);
  }

  function addItem() {
    setEditItems([...editItems, { area: DEFAULT_AREAS[0], item: "", condition: "GOOD" }]);
  }

  function removeItem(idx: number) {
    setEditItems(editItems.filter((_, i) => i !== idx));
  }

  async function save() {
    if (!editName.trim() || editItems.length === 0) {
      toast.error("Name and at least one item required");
      return;
    }

    setSaving(true);
    try {
      const body = {
        ...(editId !== "new" ? { id: editId } : {}),
        name: editName,
        items: editItems.filter((i) => i.item.trim()),
        isDefault: editDefault,
      };

      const res = await fetch("/api/tenants/move-in-templates", {
        method: editId === "new" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success(editId === "new" ? "Template created" : "Template updated");
        setEditId(null);
        fetchTemplates();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to save");
      }
    } catch {
      toast.error("Request failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/settings"
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Move-In Checklist Templates
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure checklist items for tenant move-in inspections
            </p>
          </div>
        </div>
        {!editId && (
          <button
            onClick={startNew}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New Template
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : editId ? (
        /* ── Editing view ── */
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">
                  Template Name
                </label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  placeholder="e.g. Standard Move-In Checklist"
                />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={editDefault}
                  onChange={(e) => setEditDefault(e.target.checked)}
                  className="rounded"
                />
                <Star className="h-4 w-4 text-yellow-500" />
                Default
              </label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Checklist Items</span>
                <button
                  onClick={addItem}
                  className="text-xs text-primary hover:underline"
                >
                  + Add Item
                </button>
              </div>

              {editItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-lg border bg-background p-2"
                >
                  <select
                    value={item.area}
                    onChange={(e) => {
                      const next = [...editItems];
                      next[idx] = { ...next[idx], area: e.target.value };
                      setEditItems(next);
                    }}
                    className="rounded border bg-background px-2 py-1 text-sm w-36"
                  >
                    {DEFAULT_AREAS.map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                  <input
                    value={item.item}
                    onChange={(e) => {
                      const next = [...editItems];
                      next[idx] = { ...next[idx], item: e.target.value };
                      setEditItems(next);
                    }}
                    placeholder="Item name"
                    className="flex-1 rounded border bg-background px-2 py-1 text-sm"
                  />
                  <select
                    value={item.condition}
                    onChange={(e) => {
                      const next = [...editItems];
                      next[idx] = { ...next[idx], condition: e.target.value };
                      setEditItems(next);
                    }}
                    className="rounded border bg-background px-2 py-1 text-sm w-28"
                  >
                    <option value="GOOD">Good</option>
                    <option value="FAIR">Fair</option>
                    <option value="POOR">Poor</option>
                    <option value="NEW">New</option>
                  </select>
                  <button
                    onClick={() => removeItem(idx)}
                    className="p-1 text-red-400 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setEditId(null)}
              className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="inline mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {editId === "new" ? "Create Template" : "Save Changes"}
            </button>
          </div>
        </div>
      ) : (
        /* ── List view ── */
        <div className="space-y-3">
          {templates.length === 0 ? (
            <div className="rounded-xl border bg-card p-12 text-center">
              <h3 className="text-lg font-semibold mb-2">
                No Templates Yet
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create a move-in checklist template that tenants will acknowledge
                during onboarding.
              </p>
              <button
                onClick={startNew}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Create First Template
              </button>
            </div>
          ) : (
            templates.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border bg-card p-4 flex items-center justify-between hover:shadow-sm transition-shadow cursor-pointer"
                onClick={() => startEdit(t)}
              >
                <div className="flex items-center gap-3">
                  {t.isDefault && (
                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                  )}
                  <div>
                    <p className="font-medium text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(t.items as ChecklistItem[]).length} items
                    </p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  Click to edit
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

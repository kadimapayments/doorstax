"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Loader2, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";

interface Property {
  id: string;
  name: string;
}

interface WelcomePacket {
  id: string;
  propertyId: string | null;
  property: Property | null;
  subject: string;
  body: string;
  attachmentUrls: string[];
  isActive: boolean;
}

export default function WelcomePacketsPage() {
  const [packets, setPackets] = useState<WelcomePacket[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editing state
  const [editId, setEditId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editPropertyId, setEditPropertyId] = useState<string>("");
  const [editActive, setEditActive] = useState(true);

  function fetchData() {
    Promise.all([
      fetch("/api/tenants/welcome-packet").then((r) => r.json()),
      fetch("/api/properties").then((r) => r.json()),
    ]).then(([pkts, props]) => {
      setPackets(pkts);
      setProperties(Array.isArray(props) ? props : props.properties || []);
      setLoading(false);
    });
  }

  useEffect(() => {
    fetchData();
  }, []);

  function startNew() {
    setEditId("new");
    setEditSubject("Welcome to Your New Home!");
    setEditBody(
      "Welcome! We're excited to have you as a tenant.\n\nHere's some important information for your move-in:\n\n" +
        "- Rent is due on the 1st of each month\n" +
        "- Maintenance requests can be submitted through your tenant portal\n" +
        "- Please keep common areas clean and tidy\n\n" +
        "If you have any questions, don't hesitate to reach out.\n\nWelcome home!"
    );
    setEditPropertyId("");
    setEditActive(true);
  }

  function startEdit(p: WelcomePacket) {
    setEditId(p.id);
    setEditSubject(p.subject);
    setEditBody(p.body);
    setEditPropertyId(p.propertyId || "");
    setEditActive(p.isActive);
  }

  async function save() {
    if (!editSubject.trim() || !editBody.trim()) {
      toast.error("Subject and body are required");
      return;
    }

    setSaving(true);
    try {
      const body = {
        ...(editId !== "new" ? { id: editId } : {}),
        subject: editSubject,
        body: editBody,
        propertyId: editPropertyId || null,
        isActive: editActive,
      };

      const res = await fetch("/api/tenants/welcome-packet", {
        method: editId === "new" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success(editId === "new" ? "Welcome packet created" : "Welcome packet updated");
        setEditId(null);
        fetchData();
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
              Welcome Packets
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Customize the welcome email sent to tenants after onboarding
            </p>
          </div>
        </div>
        {!editId && (
          <button
            onClick={startNew}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New Packet
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : editId ? (
        /* ── Editing view ── */
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Property (optional — leave blank for default)
              </label>
              <select
                value={editPropertyId}
                onChange={(e) => setEditPropertyId(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              >
                <option value="">Default (All Properties)</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Email Subject
              </label>
              <input
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                placeholder="Welcome to Your New Home!"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Email Body (plain text)
              </label>
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={12}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono"
                placeholder="Write your welcome message..."
              />
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              {editActive ? (
                <ToggleRight className="h-5 w-5 text-emerald-500" />
              ) : (
                <ToggleLeft className="h-5 w-5 text-muted-foreground" />
              )}
              <input
                type="checkbox"
                checked={editActive}
                onChange={(e) => setEditActive(e.target.checked)}
                className="sr-only"
              />
              {editActive ? "Active" : "Inactive"}
            </label>
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
              {saving && <Loader2 className="inline mr-2 h-4 w-4 animate-spin" />}
              {editId === "new" ? "Create Packet" : "Save Changes"}
            </button>
          </div>
        </div>
      ) : (
        /* ── List view ── */
        <div className="space-y-3">
          {packets.length === 0 ? (
            <div className="rounded-xl border bg-card p-12 text-center">
              <h3 className="text-lg font-semibold mb-2">No Welcome Packets</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create a welcome packet that will be emailed to tenants when they
                complete onboarding.
              </p>
              <button
                onClick={startNew}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Create First Packet
              </button>
            </div>
          ) : (
            packets.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border bg-card p-4 flex items-center justify-between hover:shadow-sm transition-shadow cursor-pointer"
                onClick={() => startEdit(p)}
              >
                <div>
                  <p className="font-medium text-sm">{p.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.property ? p.property.name : "Default (All Properties)"}
                    {!p.isActive && (
                      <span className="ml-2 text-red-400">(Inactive)</span>
                    )}
                  </p>
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

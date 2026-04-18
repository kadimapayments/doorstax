"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { User as UserIcon, Loader2, Save } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function VendorProfilePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    companyName: "",
  });
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/vendor/profile");
      if (res.ok) {
        const body = await res.json();
        setData(body);
        setForm({
          name: body.user?.name || "",
          phone: body.user?.phone || "",
          companyName: body.user?.companyName || "",
        });
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/vendor/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("Profile updated");
        refresh();
      } else {
        toast.error(body.error || "Update failed");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
        <div className="skeleton h-8 w-40" />
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6 page-enter">
      <div>
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <UserIcon className="h-5 w-5" />
          Profile
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your info is visible to {data?.pmCount || 0} property manager
          {data?.pmCount === 1 ? "" : "s"}.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div>
          <label className="text-xs font-medium">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="text-xs font-medium">Email</label>
          <input
            type="email"
            value={data?.user?.email || ""}
            disabled
            className="mt-1 w-full rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Email changes require admin approval. Contact DoorStax support.
          </p>
        </div>
        <div>
          <label className="text-xs font-medium">Phone</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) =>
              setForm((p) => ({ ...p, phone: e.target.value }))
            }
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="text-xs font-medium">Company name</label>
          <input
            type="text"
            value={form.companyName}
            onChange={(e) =>
              setForm((p) => ({ ...p, companyName: e.target.value }))
            }
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {data?.categories?.length > 0 && (
          <div>
            <label className="text-xs font-medium">Categories you serve</label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {data.categories.map((c: string) => (
                <span
                  key={c}
                  className="rounded-full bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-xs"
                >
                  {c}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Categories are set by each PM when they add you to their network.
            </p>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-press rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Search, UserPlus, Loader2, CheckCircle2, Mail, Phone, Building2 } from "lucide-react";

const CATEGORIES = [
  "PLUMBING", "ELECTRICAL", "HVAC", "GENERAL", "ROOFING",
  "LANDSCAPING", "CLEANING", "PEST_CONTROL", "PAINTING", "OTHER",
];

type DirectoryMatch = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  categories: string[];
  pmCount: number;
};

export default function AddVendorPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"search" | "create">("search");
  const [loading, setLoading] = useState(false);

  // Search mode state
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<DirectoryMatch[]>([]);
  const [adding, setAdding] = useState<string | null>(null);
  const [category, setCategory] = useState("GENERAL");

  // Debounced directory search
  useEffect(() => {
    if (mode !== "search") return;
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/pm/vendors/search?q=${encodeURIComponent(query.trim())}`
        );
        if (res.ok) {
          const body = await res.json();
          setResults(body.vendors || []);
        }
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, mode]);

  async function handleLinkExisting(userId: string) {
    setAdding(userId);
    try {
      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, category }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("Vendor added to your network");
        router.push("/dashboard/vendors");
      } else {
        toast.error(body.error || "Failed to add vendor");
      }
    } finally {
      setAdding(null);
    }
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        email: fd.get("email"),
        phone: fd.get("phone"),
        company: fd.get("company"),
        category: fd.get("category"),
        notes: fd.get("notes"),
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      if (body.invited) {
        toast.success("Vendor invited — portal login emailed");
      } else if (body.linked) {
        toast.success("Linked to existing DoorStax vendor");
      } else {
        toast.success("Vendor added");
      }
      router.push("/dashboard/vendors");
    } else {
      toast.error(body.error || "Failed to add vendor");
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 page-enter">
      <PageHeader
        title="Add Vendor"
        description="Find an existing DoorStax vendor or invite a new one."
      />

      {/* Mode switch */}
      <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
        <button
          onClick={() => setMode("search")}
          className={
            "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2 " +
            (mode === "search"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          <Search className="h-4 w-4" />
          Find existing
        </button>
        <button
          onClick={() => setMode("create")}
          className={
            "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2 " +
            (mode === "create"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          <UserPlus className="h-4 w-4" />
          Invite new
        </button>
      </div>

      {mode === "search" ? (
        <div className="space-y-4 animate-fade-scale-in">
          <div className="space-y-2">
            <Label htmlFor="search">Search DoorStax vendor directory</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Name, email, phone, or company…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
                autoFocus
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Finds vendors already on DoorStax who aren&apos;t yet in your network.
              They&apos;ll get a notification — no new password needed.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="link-category">Category (for your network)</Label>
            <select
              id="link-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          {query.trim().length >= 2 && !searching && results.length === 0 && (
            <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No matching vendors found.
              </p>
              <button
                onClick={() => setMode("create")}
                className="mt-2 text-sm text-primary hover:underline"
              >
                Invite a new vendor instead →
              </button>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-2 animate-stagger">
              {results.map((v) => (
                <div
                  key={v.id}
                  className="rounded-lg border bg-card p-4 card-hover"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">
                        {v.name || "Unnamed vendor"}
                      </p>
                      {v.company && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Building2 className="h-3 w-3" />
                          {v.company}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                        {v.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {v.email}
                          </span>
                        )}
                        {v.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {v.phone}
                          </span>
                        )}
                      </div>
                      {v.categories.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {v.categories.slice(0, 5).map((c) => (
                            <span
                              key={c}
                              className="text-[10px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground"
                            >
                              {c.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-2">
                        Works with {v.pmCount} other{" "}
                        {v.pmCount === 1 ? "PM" : "PMs"} on DoorStax
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleLinkExisting(v.id)}
                      disabled={adding === v.id}
                    >
                      {adding === v.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                      )}
                      Add to network
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleCreate} className="space-y-4 animate-fade-scale-in">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company">Company</Label>
            <Input id="company" name="company" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" />
              <p className="text-[11px] text-muted-foreground">
                If provided, the vendor gets portal access automatically.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <PhoneInput id="phone" name="phone" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <select
              name="category"
              id="category"
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              name="notes"
              id="notes"
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Adding…
              </>
            ) : (
              "Add Vendor"
            )}
          </Button>
        </form>
      )}
    </div>
  );
}

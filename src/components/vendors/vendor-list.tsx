"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search, LayoutGrid, List, Star } from "lucide-react";

interface VendorItem {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  category: string;
  rating: number | null;
  isActive: boolean;
  openTickets: number;
}

const CATEGORIES: Record<string, string> = {
  PLUMBING: "Plumbing",
  ELECTRICAL: "Electrical",
  HVAC: "HVAC",
  GENERAL: "General",
  ROOFING: "Roofing",
  LANDSCAPING: "Landscaping",
  PAINTING: "Painting",
  CLEANING: "Cleaning",
  PEST_CONTROL: "Pest Control",
  APPLIANCE: "Appliance",
  LOCKSMITH: "Locksmith",
  OTHER: "Other",
};

export function VendorList({ vendors }: { vendors: VendorItem[] }) {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const filtered = vendors.filter((v) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      v.name.toLowerCase().includes(q) ||
      (v.company && v.company.toLowerCase().includes(q)) ||
      v.category.toLowerCase().includes(q) ||
      (v.email && v.email.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search vendors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{filtered.length} vendor{filtered.length !== 1 ? "s" : ""}</span>
          <div className="flex items-center gap-1 rounded-lg border p-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "rounded p-1.5 transition-colors",
                viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "rounded p-1.5 transition-colors",
                viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((v) => (
            <Link key={v.id} href={`/dashboard/vendors/${v.id}`}>
              <div className="rounded-lg border border-border p-5 hover:border-primary/30 transition-colors card-glow cursor-pointer">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{v.name}</span>
                  {v.rating && (
                    <div className="flex items-center gap-1 text-amber-500">
                      <Star className="h-3 w-3 fill-current" />
                      <span className="text-xs font-medium">{v.rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>
                {v.company && <p className="text-sm text-muted-foreground">{v.company}</p>}
                <div className="mt-2 flex items-center gap-2">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {CATEGORIES[v.category] || v.category}
                  </span>
                  {v.openTickets > 0 && (
                    <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-600">
                      {v.openTickets} active
                    </span>
                  )}
                  {!v.isActive && (
                    <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-600">Inactive</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Vendor</th>
                <th className="px-4 py-2.5 font-medium">Company</th>
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 font-medium">Contact</th>
                <th className="px-4 py-2.5 font-medium">Rating</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr key={v.id} className="border-b last:border-0 hover:bg-muted/50 cursor-pointer" onClick={() => (window.location.href = `/dashboard/vendors/${v.id}`)}>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/vendors/${v.id}`} className="font-medium text-primary hover:underline">{v.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{v.company || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted capitalize">{(CATEGORIES[v.category] || v.category).toLowerCase()}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {v.email && <div>{v.email}</div>}
                    {v.phone && <div>{v.phone}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {v.rating ? (
                      <span className="flex items-center gap-1 text-sm">
                        <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                        {v.rating.toFixed(1)}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {v.isActive ? (
                      <span className="text-xs text-emerald-500">Active</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Inactive</span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No vendors found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, RefreshCw, Trash2, ChevronDown, ChevronUp, Clock } from "lucide-react";

interface Invite {
  id: string;
  name: string | null;
  email: string;
  property: string;
  unit: string;
  status: "pending" | "expired" | "accepted";
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
}

export function PendingInvites() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchInvites();
  }, []);

  async function fetchInvites() {
    try {
      const res = await fetch("/api/tenants/invite");
      if (res.ok) {
        const data = await res.json();
        setInvites(data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function resend(id: string) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/tenants/invite/${id}`, { method: "POST" });
      if (res.ok) {
        await fetchInvites();
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this invitation? The tenant will no longer be able to accept it.")) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/tenants/invite/${id}`, { method: "DELETE" });
      if (res.ok) {
        setInvites((prev) => prev.filter((i) => i.id !== id));
      }
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) return null;
  if (invites.length === 0) return null;

  const pendingCount = invites.filter((i) => i.status === "pending").length;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            Pending Invitations
          </span>
          {pendingCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {pendingCount} pending
            </Badge>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="border-t">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Email</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Property</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Unit</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Sent</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 font-medium">{inv.name || "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{inv.email}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{inv.property}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{inv.unit}</td>
                    <td className="px-4 py-2.5">
                      {inv.status === "pending" && (
                        <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                          <Clock className="mr-1 h-3 w-3" />
                          Pending
                        </Badge>
                      )}
                      {inv.status === "expired" && (
                        <Badge variant="destructive" className="opacity-70">
                          Expired
                        </Badge>
                      )}
                      {inv.status === "accepted" && (
                        <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                          Accepted
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">
                      {new Date(inv.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {inv.status !== "accepted" && (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => resend(inv.id)}
                            disabled={actionLoading === inv.id}
                          >
                            <RefreshCw className={`h-3 w-3 mr-1 ${actionLoading === inv.id ? "animate-spin" : ""}`} />
                            Resend
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                            onClick={() => revoke(inv.id)}
                            disabled={actionLoading === inv.id}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Revoke
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

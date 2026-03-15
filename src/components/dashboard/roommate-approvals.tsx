"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Check, X, ChevronDown, ChevronUp, Clock } from "lucide-react";

interface RoommateRequest {
  id: string;
  tenantName: string;
  tenantEmail: string;
  property: string;
  unit: string;
  roommateName: string;
  roommateEmail: string;
  roommatePhone: string | null;
  status: string;
  createdAt: string;
}

export function RoommateApprovals() {
  const [requests, setRequests] = useState<RoommateRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  async function fetchRequests() {
    try {
      const res = await fetch("/api/roommate-requests");
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(id: string, action: "approve" | "reject") {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/roommate-requests/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        await fetchRequests();
      }
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) return null;

  const pendingRequests = requests.filter((r) => r.status === "PENDING");
  if (pendingRequests.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Roommate Approvals</span>
          <Badge variant="secondary" className="text-xs bg-amber-500/10 text-amber-500 border-amber-500/20">
            {pendingRequests.length} pending
          </Badge>
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
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                    Requested By
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                    Property / Unit
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                    Roommate
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                    Email
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {pendingRequests.map((req) => (
                  <tr
                    key={req.id}
                    className="border-b last:border-0 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-2.5 font-medium">
                      {req.tenantName}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {req.property} — {req.unit}
                    </td>
                    <td className="px-4 py-2.5 font-medium">
                      {req.roommateName}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {req.roommateEmail}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                        <Clock className="mr-1 h-3 w-3" />
                        Pending
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-600 hover:bg-emerald-500/10"
                          onClick={() => handleAction(req.id, "approve")}
                          disabled={actionLoading === req.id}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                          onClick={() => handleAction(req.id, "reject")}
                          disabled={actionLoading === req.id}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Reject
                        </Button>
                      </div>
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

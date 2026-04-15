"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { showConfirm } from "@/components/admin/dialog-prompt";
import {
  Plus,
  Users,
  MoreVertical,
  Loader2,
  UserMinus,
  UserCheck,
  Trash2,
} from "lucide-react";
import { ROLE_PRESETS, PERMISSION_LABELS } from "@/lib/team/role-presets";

interface TeamRow {
  id: string;
  email: string;
  name: string;
  role: string;
  roleLabel: string;
  status: string;
  propertyNames: string[];
  invitedAt: string;
  acceptedAt: string | null;
}

const ROLE_COLOR: Record<string, string> = {
  LEASING_AGENT: "bg-blue-500/15 text-blue-500 border-blue-500/20",
  ASSISTANT_PM: "bg-purple-500/15 text-purple-500 border-purple-500/20",
  REGIONAL_MANAGER: "bg-indigo-500/15 text-indigo-500 border-indigo-500/20",
  MANAGER: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
  ACCOUNTING: "bg-green-500/15 text-green-500 border-green-500/20",
  CARETAKER: "bg-amber-500/15 text-amber-500 border-amber-500/20",
  SERVICE_TECH: "bg-orange-500/15 text-orange-500 border-orange-500/20",
  STAFF: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
};

const STATUS_COLOR: Record<string, string> = {
  INVITED: "bg-amber-500/15 text-amber-500 border-amber-500/20",
  ACTIVE: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
  DEACTIVATED: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
};

interface PropertyOption {
  id: string;
  name: string;
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamRow[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  // Invite form state
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [selectedPropIds, setSelectedPropIds] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [mRes, pRes] = await Promise.all([
          fetch("/api/team"),
          fetch("/api/properties"),
        ]);
        if (mRes.ok) setMembers(await mRes.json());
        if (pRes.ok) {
          const data = await pRes.json();
          setProperties(
            (Array.isArray(data) ? data : []).map(
              (p: { id: string; name: string }) => ({
                id: p.id,
                name: p.name,
              })
            )
          );
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function selectRole(key: string) {
    setRole(key);
    const preset = ROLE_PRESETS[key];
    if (preset) setPermissions({ ...preset.permissions });
  }

  function toggleProperty(id: string) {
    setSelectedPropIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleInvite() {
    if (!email || !role) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: name || undefined,
          role,
          propertyIds: selectedPropIds,
          notes: notes || undefined,
          ...permissions,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Invitation sent");
        // Refresh
        const mRes = await fetch("/api/team");
        if (mRes.ok) setMembers(await mRes.json());
        setOpen(false);
        setEmail("");
        setName("");
        setRole("");
        setSelectedPropIds([]);
        setPermissions({});
        setNotes("");
      } else {
        toast.error(data.error || "Failed to invite");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  async function runAction(
    id: string,
    action: string,
    method: "POST" | "DELETE" = "POST"
  ) {
    setActionId(id);
    try {
      const res = await fetch(`/api/team/${id}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "POST" ? JSON.stringify({ action }) : undefined,
      });
      if (res.ok) {
        toast.success("Done");
        const mRes = await fetch("/api/team");
        if (mRes.ok) setMembers(await mRes.json());
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || "Failed");
      }
    } finally {
      setActionId(null);
    }
  }

  const active = members.filter((m) => m.status === "ACTIVE").length;
  const invited = members.filter((m) => m.status === "INVITED").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description="Manage your staff members and their property access."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Team Member
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Team Member</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                {/* Basic info */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="team@example.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Name</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Full name"
                    />
                  </div>
                </div>

                {/* Role selector */}
                <div className="space-y-1.5">
                  <Label>Role *</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(ROLE_PRESETS).map(([key, preset]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => selectRole(key)}
                        className={
                          "rounded-lg border p-3 text-left transition-colors " +
                          (role === key
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "hover:bg-muted")
                        }
                      >
                        <p className="text-sm font-medium">{preset.label}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                          {preset.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Property assignments */}
                {properties.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Property Access</Label>
                    <p className="text-xs text-muted-foreground">
                      Leave empty for all properties.
                    </p>
                    <div className="space-y-1 max-h-40 overflow-y-auto rounded-lg border p-2">
                      {properties.map((p) => (
                        <label
                          key={p.id}
                          className="flex items-center gap-2 py-1 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedPropIds.includes(p.id)}
                            onChange={() => toggleProperty(p.id)}
                            className="h-4 w-4 rounded border-input accent-primary"
                          />
                          <span className="text-sm">{p.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Fine-grained permissions */}
                {role && (
                  <details>
                    <summary className="text-sm font-medium cursor-pointer">
                      Customize Permissions
                    </summary>
                    <div className="mt-2 space-y-2 pl-3 border-l-2 border-primary/20">
                      {Object.entries(permissions).map(([key, val]) => (
                        <label
                          key={key}
                          className="flex items-center justify-between text-sm"
                        >
                          <span>
                            {PERMISSION_LABELS[key] || key}
                          </span>
                          <input
                            type="checkbox"
                            checked={val}
                            onChange={() =>
                              setPermissions((prev) => ({
                                ...prev,
                                [key]: !prev[key],
                              }))
                            }
                            className="h-4 w-4 rounded border-input accent-primary"
                          />
                        </label>
                      ))}
                    </div>
                  </details>
                )}

                {/* Notes */}
                <div className="space-y-1.5">
                  <Label>Notes (optional)</Label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Internal notes..."
                    rows={2}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleInvite}
                  disabled={!email || !role || submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Invitation"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Stats */}
      {members.length > 0 && (
        <div className="flex gap-4">
          <Card className="border-border flex-1">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">
                Total
              </div>
              <div className="text-2xl font-bold mt-1">{members.length}</div>
            </CardContent>
          </Card>
          <Card className="border-border flex-1">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">
                Active
              </div>
              <div className="text-2xl font-bold mt-1 text-emerald-500">
                {active}
              </div>
            </CardContent>
          </Card>
          <Card className="border-border flex-1">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">
                Invited
              </div>
              <div className="text-2xl font-bold mt-1 text-amber-500">
                {invited}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Member list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : members.length === 0 ? (
        <EmptyState
          icon={<Users className="h-12 w-12" />}
          title="No team members"
          description="Add staff members to help manage your properties. Assign roles, set permissions, and scope access to specific properties."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Team Member
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <Card key={m.id} className="border-border">
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">
                      {m.name || m.email}
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        ROLE_COLOR[m.role] || ROLE_COLOR.STAFF
                      }
                    >
                      {m.roleLabel}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        STATUS_COLOR[m.status] || STATUS_COLOR.INVITED
                      }
                    >
                      {m.status === "ACTIVE"
                        ? "Active"
                        : m.status === "INVITED"
                          ? "Pending"
                          : "Deactivated"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {m.email}
                    {m.propertyNames.length > 0 && (
                      <span>
                        {" "}
                        &middot; {m.propertyNames.join(", ")}
                      </span>
                    )}
                    {m.propertyNames.length === 0 && (
                      <span> &middot; All properties</span>
                    )}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      disabled={actionId === m.id}
                    >
                      {actionId === m.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MoreVertical className="h-4 w-4" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {m.status !== "DEACTIVATED" && (
                      <DropdownMenuItem
                        onClick={() =>
                          runAction(m.id, "deactivate")
                        }
                      >
                        <UserMinus className="h-4 w-4 mr-2" />
                        Deactivate
                      </DropdownMenuItem>
                    )}
                    {m.status === "DEACTIVATED" && (
                      <DropdownMenuItem
                        onClick={() =>
                          runAction(m.id, "reactivate")
                        }
                      >
                        <UserCheck className="h-4 w-4 mr-2" />
                        Reactivate
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={async () => {
                        if (await showConfirm({ title: "Remove Team Member?", description: "This will revoke their access to the dashboard immediately. Their historical actions remain in the audit log.", confirmLabel: "Remove Team Member", destructive: true })) {
                          runAction(m.id, "", "DELETE");
                        }
                      }}
                      className="text-red-500"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

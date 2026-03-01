"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";
import { Plus, Users, ArrowLeft } from "lucide-react";

interface TeamMember {
  id: string;
  role: string;
  isActive: boolean;
  invitedAt: string;
  acceptedAt: string | null;
  user: { name: string; email: string; phone: string | null };
}

const ROLE_LABELS: Record<string, string> = {
  MANAGER: "Manager",
  ACCOUNTING: "Accounting",
  CARETAKER: "Caretaker",
  SERVICE_TECH: "Service Tech",
};

export default function TeamSettingsPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("CARETAKER");

  useEffect(() => {
    fetch("/api/team")
      .then((r) => r.json())
      .then((data) => setMembers(Array.isArray(data) ? data : []));
  }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to add team member");
        setLoading(false);
        return;
      }

      toast.success("Team member added");
      setMembers([data, ...members]);
      setOpen(false);
      setEmail("");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/settings"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Settings
      </Link>

      <PageHeader
        title="Team Members"
        description="Manage your team and assign roles."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Member
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Team Member</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="team@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MANAGER">Manager</SelectItem>
                      <SelectItem value="ACCOUNTING">Accounting</SelectItem>
                      <SelectItem value="CARETAKER">Caretaker</SelectItem>
                      <SelectItem value="SERVICE_TECH">Service Tech</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Adding..." : "Add Member"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {members.length === 0 ? (
        <EmptyState
          icon={<Users className="h-12 w-12" />}
          title="No team members"
          description="Add team members to help manage your properties. They can be assigned as managers, accountants, caretakers, or service technicians."
        />
      ) : (
        <div className="space-y-3 max-w-2xl">
          {members.map((m) => (
            <Card key={m.id} className="border-border">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{m.user.name}</p>
                  <p className="text-sm text-muted-foreground">{m.user.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm">{ROLE_LABELS[m.role] || m.role}</span>
                  <StatusBadge status={m.isActive ? "ACTIVE" : "PAUSED"} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { UserPlus, Mail, Plus } from "lucide-react";

interface AssignTenantDialogProps {
  unitId: string;
  propertyId: string;
  trigger?: ReactNode;
}

export function AssignTenantDialog({
  unitId,
  propertyId,
  trigger,
}: AssignTenantDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleAddNew(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      phone: (formData.get("phone") as string) || undefined,
      unitId,
    };

    try {
      const res = await fetch("/api/tenants/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to add tenant");
        setLoading(false);
        return;
      }

      toast.success("Tenant added successfully");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      email: formData.get("invite-email") as string,
      unitId,
    };

    try {
      const res = await fetch("/api/tenants/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to send invite");
        setLoading(false);
        return;
      }

      toast.success("Invite sent successfully");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <UserPlus className="mr-2 h-4 w-4" />
            Assign Tenant
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Tenant</DialogTitle>
          <DialogDescription>
            Add a new tenant or send an invite to an existing user.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="add-new" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="add-new" className="flex-1">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add New
            </TabsTrigger>
            <TabsTrigger value="send-invite" className="flex-1">
              <Mail className="mr-1.5 h-3.5 w-3.5" />
              Send Invite
            </TabsTrigger>
          </TabsList>

          <TabsContent value="add-new">
            <form onSubmit={handleAddNew} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="tenant-name">Full Name</Label>
                <Input
                  id="tenant-name"
                  name="name"
                  placeholder="John Doe"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenant-email">Email</Label>
                <Input
                  id="tenant-email"
                  name="email"
                  type="email"
                  placeholder="john@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenant-phone">Phone (optional)</Label>
                <Input
                  id="tenant-phone"
                  name="phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Adding..." : "Add Tenant"}
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="send-invite">
            <form onSubmit={handleSendInvite} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email Address</Label>
                <Input
                  id="invite-email"
                  name="invite-email"
                  type="email"
                  placeholder="tenant@example.com"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                An invitation link will be sent to this email address. The
                recipient can use it to create their account and join this unit.
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Sending..." : "Send Invite"}
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EditTenantDialogProps {
  tenant: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    status: string;
  };
  /** Controlled open state (optional) */
  open?: boolean;
  /** Controlled open change handler (optional) */
  onOpenChange?: (open: boolean) => void;
}

export function EditTenantDialog({ tenant, open: controlledOpen, onOpenChange }: EditTenantDialogProps) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(tenant.name);
  const [email, setEmail] = useState(tenant.email);
  const [phone, setPhone] = useState(tenant.phone || "");
  const [status, setStatus] = useState(tenant.status);

  function resetForm() {
    setName(tenant.name);
    setEmail(tenant.email);
    setPhone(tenant.phone || "");
    setStatus(tenant.status);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    setLoading(true);

    try {
      const res = await fetch(`/api/tenants/${tenant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          status,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to update tenant");
        setLoading(false);
        return;
      }

      toast.success("Tenant updated");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm">
            <Pencil className="mr-1 h-3 w-3" />
            Edit
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Tenant</DialogTitle>
          <DialogDescription>
            Update tenant details and status.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-tenant-name">Name</Label>
            <Input
              id="edit-tenant-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tenant name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-tenant-email">Email</Label>
            <Input
              id="edit-tenant-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tenant@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-tenant-phone">Phone</Label>
            <PhoneInput
              id="edit-tenant-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PROSPECT">Prospect</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="PREVIOUS">Previous</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !name.trim() || !email.trim()}
            >
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

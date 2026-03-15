"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";
import { Plus, Pencil, Power } from "lucide-react";

interface WhiteLabelPartner {
  id: string;
  name: string;
  slug: string;
  customDomain: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  accentColor: string;
  platformFeeShare: number;
  monthlyFee: number;
  isActive: boolean;
  createdAt: string;
  _count: { users: number };
}

interface PartnerFormData {
  name: string;
  slug: string;
  customDomain: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  accentColor: string;
  platformFeeShare: string;
  monthlyFee: string;
}

const defaultFormData: PartnerFormData = {
  name: "",
  slug: "",
  customDomain: "",
  logoUrl: "",
  faviconUrl: "",
  primaryColor: "#5B00FF",
  accentColor: "#BDA2FF",
  platformFeeShare: "60",
  monthlyFee: "0",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function isValidHex(value: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value);
}

// TODO: White Label Platform Creation — Future Work
// Currently, creating a white label partner only stores config in the DB.
// To make it fully functional, the following is needed:
// 1. Middleware routing: detect domain/slug and apply partner branding
// 2. Vercel custom domains: programmatically add custom domains via Vercel API
// 3. Slug-based access: support `app.doorstax.com/partner-slug` routing
// 4. The existing WhiteLabelContext provides branding values but needs middleware integration
export function WhiteLabelManagement() {
  const [partners, setPartners] = useState<WhiteLabelPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<PartnerFormData>(defaultFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPartners = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/white-label");
      if (!res.ok) throw new Error("Failed to fetch partners");
      const data = await res.json();
      setPartners(data);
    } catch {
      setError("Failed to load partners");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  function openAdd() {
    setEditingId(null);
    setFormData(defaultFormData);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(partner: WhiteLabelPartner) {
    setEditingId(partner.id);
    setFormData({
      name: partner.name,
      slug: partner.slug,
      customDomain: partner.customDomain || "",
      logoUrl: partner.logoUrl || "",
      faviconUrl: partner.faviconUrl || "",
      primaryColor: partner.primaryColor,
      accentColor: partner.accentColor,
      platformFeeShare: String(Number(partner.platformFeeShare) * 100),
      monthlyFee: String(Number(partner.monthlyFee)),
    });
    setError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    setError(null);

    if (!formData.name.trim()) {
      setError("Name is required");
      return;
    }
    if (!formData.slug.trim()) {
      setError("Slug is required");
      return;
    }
    if (formData.primaryColor && !isValidHex(formData.primaryColor)) {
      setError("Primary color must be a valid hex code (e.g. #5B00FF)");
      return;
    }
    if (formData.accentColor && !isValidHex(formData.accentColor)) {
      setError("Accent color must be a valid hex code (e.g. #BDA2FF)");
      return;
    }

    const feeShare = parseFloat(formData.platformFeeShare);
    if (isNaN(feeShare) || feeShare < 0 || feeShare > 100) {
      setError("Platform fee share must be between 0 and 100");
      return;
    }

    const monthly = parseFloat(formData.monthlyFee);
    if (isNaN(monthly) || monthly < 0) {
      setError("Monthly fee must be 0 or greater");
      return;
    }

    setSaving(true);

    const payload = {
      name: formData.name.trim(),
      slug: formData.slug.trim(),
      customDomain: formData.customDomain.trim() || null,
      logoUrl: formData.logoUrl.trim() || null,
      faviconUrl: formData.faviconUrl.trim() || null,
      primaryColor: formData.primaryColor || "#5B00FF",
      accentColor: formData.accentColor || "#BDA2FF",
      platformFeeShare: feeShare / 100,
      monthlyFee: monthly,
    };

    try {
      const url = editingId
        ? `/api/admin/white-label/${editingId}`
        : "/api/admin/white-label";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save partner");
      }

      setDialogOpen(false);
      fetchPartners();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save partner");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(partner: WhiteLabelPartner) {
    try {
      const url = partner.isActive
        ? `/api/admin/white-label/${partner.id}`
        : `/api/admin/white-label/${partner.id}`;
      const method = partner.isActive ? "DELETE" : "PUT";
      const body = partner.isActive ? undefined : JSON.stringify({ isActive: true });

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (!res.ok) throw new Error("Failed to update status");
      fetchPartners();
    } catch {
      setError("Failed to update partner status");
    }
  }

  function handleNameChange(value: string) {
    setFormData((prev) => ({
      ...prev,
      name: value,
      // Only auto-generate slug when adding, not editing
      slug: editingId ? prev.slug : slugify(value),
    }));
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="White Label Partners"
          description="Manage white-label partner configurations."
        />
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground py-8 text-center">
              Loading...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="White Label Partners"
        description="Manage white-label partner configurations."
        actions={
          <Button size="sm" onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add Partner
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Partners ({partners.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {partners.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No white-label partners yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Revenue Share</TableHead>
                  <TableHead>Monthly Fee</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.map((partner) => (
                  <TableRow key={partner.id}>
                    <TableCell className="font-medium">
                      {partner.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {partner.slug}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {partner.customDomain || "—"}
                    </TableCell>
                    <TableCell>
                      {(Number(partner.platformFeeShare) * 100).toFixed(0)}%
                    </TableCell>
                    <TableCell>
                      ${Number(partner.monthlyFee).toFixed(2)}
                    </TableCell>
                    <TableCell>{partner._count.users}</TableCell>
                    <TableCell>
                      <Badge
                        variant={partner.isActive ? "default" : "secondary"}
                      >
                        {partner.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => openEdit(partner)}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => toggleActive(partner)}
                          title={
                            partner.isActive ? "Deactivate" : "Activate"
                          }
                        >
                          <Power
                            className={`h-4 w-4 ${
                              partner.isActive
                                ? "text-green-600"
                                : "text-muted-foreground"
                            }`}
                          />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Partner" : "Add Partner"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Partner name"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, slug: e.target.value }))
                }
                placeholder="partner-slug"
              />
              <p className="text-xs text-muted-foreground">
                Lowercase letters, numbers, and hyphens only
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="customDomain">Custom Domain</Label>
              <Input
                id="customDomain"
                value={formData.customDomain}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    customDomain: e.target.value,
                  }))
                }
                placeholder="app.partner.com"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input
                id="logoUrl"
                value={formData.logoUrl}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, logoUrl: e.target.value }))
                }
                placeholder="https://..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="primaryColor">Primary Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={isValidHex(formData.primaryColor) ? formData.primaryColor : "#5B00FF"}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        primaryColor: e.target.value,
                      }))
                    }
                    className="h-9 w-12 cursor-pointer rounded border border-input"
                  />
                  <Input
                    id="primaryColor"
                    value={formData.primaryColor}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        primaryColor: e.target.value,
                      }))
                    }
                    placeholder="#5B00FF"
                    className="font-mono"
                  />
                </div>
                {formData.primaryColor && !isValidHex(formData.primaryColor) && (
                  <p className="text-xs text-destructive">Invalid hex</p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="accentColor">Accent Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={isValidHex(formData.accentColor) ? formData.accentColor : "#BDA2FF"}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        accentColor: e.target.value,
                      }))
                    }
                    className="h-9 w-12 cursor-pointer rounded border border-input"
                  />
                  <Input
                    id="accentColor"
                    value={formData.accentColor}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        accentColor: e.target.value,
                      }))
                    }
                    placeholder="#BDA2FF"
                    className="font-mono"
                  />
                </div>
                {formData.accentColor && !isValidHex(formData.accentColor) && (
                  <p className="text-xs text-destructive">Invalid hex</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="platformFeeShare">
                  Platform Fee Share (%)
                </Label>
                <Input
                  id="platformFeeShare"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.platformFeeShare}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      platformFeeShare: e.target.value,
                    }))
                  }
                  placeholder="60"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="monthlyFee">Monthly Fee ($)</Label>
                <Input
                  id="monthlyFee"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.monthlyFee}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      monthlyFee: e.target.value,
                    }))
                  }
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

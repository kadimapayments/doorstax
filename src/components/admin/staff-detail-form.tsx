"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, Loader2 } from "lucide-react";
import { ADMIN_ROLE_LABELS, ADMIN_PERMISSIONS, getAdminPermissions } from "@/lib/admin-permissions";
import type { AdminRole } from "@prisma/client";

interface StaffDetailFormProps {
  staffId: string;
  name: string;
  email: string;
  adminRole: AdminRole;
  customPermissions: string[];
  isActive: boolean;
}

const ROLES: AdminRole[] = [
  "SUPER_ADMIN",
  "PLATFORM_ADMIN",
  "OPERATIONS_MANAGER",
  "FINANCE_MANAGER",
  "SUPPORT_AGENT",
  "VIEWER",
];

const PERMISSION_GROUPS: { label: string; permissions: string[] }[] = [
  {
    label: "Management",
    permissions: ["admin:overview", "admin:landlords", "admin:tenants", "admin:properties", "admin:staff", "admin:settings", "admin:leads", "admin:audit"],
  },
  {
    label: "Financial",
    permissions: ["admin:payments", "admin:payouts", "admin:leases", "admin:expenses", "admin:volume"],
  },
  {
    label: "Support & Applications",
    permissions: ["admin:tickets", "admin:applications"],
  },
  {
    label: "Analytics",
    permissions: ["admin:risk", "admin:insights"],
  },
  {
    label: "Platform",
    permissions: ["admin:integrations"],
  },
];

export function StaffDetailForm({
  staffId,
  name,
  email,
  adminRole: initialRole,
  customPermissions: initialCustom,
  isActive: initialActive,
}: StaffDetailFormProps) {
  const router = useRouter();
  const [adminRole, setAdminRole] = useState<AdminRole>(initialRole);
  const [useCustom, setUseCustom] = useState(initialCustom.length > 0);
  const [customPerms, setCustomPerms] = useState<string[]>(
    initialCustom.length > 0 ? initialCustom : getAdminPermissions(initialRole)
  );
  const [isActive, setIsActive] = useState(initialActive);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function togglePermission(perm: string) {
    setCustomPerms((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  }

  function handleRoleChange(role: AdminRole) {
    setAdminRole(role);
    if (!useCustom) {
      setCustomPerms(getAdminPermissions(role));
    }
  }

  function handleToggleCustom() {
    if (useCustom) {
      // Switch to role defaults
      setUseCustom(false);
      setCustomPerms(getAdminPermissions(adminRole));
    } else {
      // Switch to custom
      setUseCustom(true);
    }
  }

  async function handleSave() {
    setLoading(true);
    setError("");
    setSaved(false);

    try {
      const res = await fetch(`/api/admin/staff/${staffId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminRole,
          customPermissions: useCustom ? customPerms : [],
          isActive,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || "Failed to update");
        setLoading(false);
        return;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setLoading(false);
      router.refresh();
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  // Get which permissions the current role defaults give
  const roleDefaultPerms = getAdminPermissions(adminRole);

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Staff Member</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-muted-foreground">Name</Label>
            <p className="font-medium">{name}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Email</Label>
            <p className="font-medium">{email}</p>
          </div>
        </CardContent>
      </Card>

      {/* Role & Status */}
      <Card>
        <CardHeader>
          <CardTitle>Role & Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={adminRole}
              onChange={(e) => handleRoleChange(e.target.value as AdminRole)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{ADMIN_ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <Label htmlFor="active">Active</Label>
            <button
              id="active"
              type="button"
              role="switch"
              aria-checked={isActive}
              onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isActive ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isActive ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <span className="text-sm text-muted-foreground">
              {isActive ? "Active" : "Inactive"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Permissions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Permissions</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleCustom}
            >
              {useCustom ? "Use Role Defaults" : "Customize Permissions"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!useCustom && (
            <p className="text-sm text-muted-foreground mb-4">
              Using default permissions for {ADMIN_ROLE_LABELS[adminRole]}. Click &quot;Customize Permissions&quot; to override.
            </p>
          )}

          <div className="space-y-6">
            {PERMISSION_GROUPS.map((group) => (
              <div key={group.label}>
                <h4 className="text-sm font-medium mb-2">{group.label}</h4>
                <div className="grid grid-cols-2 gap-2">
                  {group.permissions.map((perm) => {
                    const isChecked = useCustom
                      ? customPerms.includes(perm)
                      : roleDefaultPerms.includes(perm);
                    const label = perm.replace("admin:", "").replace(/_/g, " ");

                    return (
                      <label
                        key={perm}
                        className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors ${
                          isChecked
                            ? "border-primary/30 bg-primary/5"
                            : "border-border"
                        } ${!useCustom ? "opacity-60 cursor-default" : "hover:bg-muted/50"}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={!useCustom}
                          onChange={() => togglePermission(perm)}
                          className="rounded border-input"
                        />
                        <span className="capitalize">{label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {loading ? "Saving..." : "Save Changes"}
        </Button>
        {saved && (
          <span className="text-sm text-emerald-500">Changes saved!</span>
        )}
      </div>
    </div>
  );
}

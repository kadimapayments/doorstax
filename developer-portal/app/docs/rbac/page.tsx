"use client";

import DocLayout from "@/components/doc-layout";

const roles = [
  {
    name: "Super Admin",
    badge: "SUPER_ADMIN",
    color: "text-accent-red",
    bg: "bg-accent-red/10",
    border: "border-accent-red/20",
    description:
      "Full platform access. Manages all organizations, billing, and system-wide settings.",
    permissions: [
      "All admin permissions",
      "Organization management",
      "System configuration",
      "Billing and subscriptions",
      "User provisioning across all orgs",
    ],
    restrictions: ["None — unrestricted access"],
  },
  {
    name: "Platform Admin",
    badge: "PLATFORM_ADMIN",
    color: "text-accent-amber",
    bg: "bg-accent-amber/10",
    border: "border-accent-amber/20",
    description:
      "Manages platform operations, reviews flagged items, and handles support escalations.",
    permissions: [
      "All admin:* permissions",
      "View all organizations",
      "Manage flagged payments",
      "Support escalation access",
      "Reporting dashboard",
    ],
    restrictions: ["Cannot modify billing or system configuration"],
  },
  {
    name: "Landlord / Owner",
    badge: "OWNER",
    color: "text-accent-purple",
    bg: "bg-accent-purple/10",
    border: "border-accent-purple/20",
    description:
      "Property owner with full access to their portfolio. Can manage properties, teams, and payouts.",
    permissions: [
      "properties:read, properties:write",
      "payments:read, payments:write",
      "payouts:read, payouts:write",
      "team:read, team:write",
      "leases:read, leases:write",
      "reports:read",
    ],
    restrictions: ["Scoped to owned properties only"],
  },
  {
    name: "Property Manager",
    badge: "PROPERTY_MANAGER",
    color: "text-accent-blue",
    bg: "bg-accent-blue/10",
    border: "border-accent-blue/20",
    description:
      "Day-to-day management of assigned properties. Handles tenants, leases, and maintenance.",
    permissions: [
      "properties:read",
      "payments:read, payments:write",
      "leases:read, leases:write",
      "tenants:read, tenants:write",
      "maintenance:read, maintenance:write",
    ],
    restrictions: [
      "Cannot manage payouts",
      "Cannot modify property ownership",
      "Scoped to assigned properties",
    ],
  },
  {
    name: "Accountant / Finance",
    badge: "ACCOUNTANT",
    color: "text-accent-green",
    bg: "bg-accent-green/10",
    border: "border-accent-green/20",
    description:
      "Financial oversight with read access to payments, ledger, and payouts. Limited write access.",
    permissions: [
      "payments:read",
      "payouts:read",
      "ledger:read",
      "reports:read",
      "reconciliation:read",
    ],
    restrictions: [
      "Read-only for most resources",
      "Cannot manage tenants or leases",
      "Cannot modify properties",
    ],
  },
  {
    name: "Tenant",
    badge: "TENANT",
    color: "text-accent-lavender",
    bg: "bg-accent-lavender/10",
    border: "border-accent-lavender/20",
    description:
      "Tenant with access to their own lease, payment history, and maintenance requests.",
    permissions: [
      "Own lease:read",
      "Own payments:read, payments:write (pay rent)",
      "maintenance:read, maintenance:write (own unit)",
      "profile:read, profile:write",
    ],
    restrictions: [
      "Cannot view other tenants",
      "Cannot access property-level data",
      "Strictly scoped to own unit and lease",
    ],
  },
  {
    name: "Partner",
    badge: "PARTNER",
    color: "text-text-secondary",
    bg: "bg-bg-hover",
    border: "border-border",
    description:
      "External integration partner with API access scoped to specific endpoints.",
    permissions: [
      "API access for assigned endpoints",
      "Webhook subscriptions",
      "Read access to shared resources",
    ],
    restrictions: [
      "No UI access",
      "Rate limited",
      "Scoped to partner agreement",
    ],
  },
];

const adminPermissions = [
  { permission: "admin:overview", description: "Platform overview dashboard" },
  { permission: "admin:payments", description: "View and manage all payments" },
  { permission: "admin:payouts", description: "View and manage all payouts" },
  { permission: "admin:properties", description: "View and manage all properties" },
  { permission: "admin:users", description: "User management across organizations" },
  { permission: "admin:organizations", description: "Organization management" },
  { permission: "admin:reports", description: "Platform-wide reporting" },
  { permission: "admin:settings", description: "System configuration" },
];

const teamPermissions = [
  { permission: "properties:read", description: "View properties" },
  { permission: "properties:write", description: "Create and update properties" },
  { permission: "payments:read", description: "View payment records" },
  { permission: "payments:write", description: "Process and manage payments" },
  { permission: "payouts:read", description: "View payout history" },
  { permission: "payouts:write", description: "Initiate and manage payouts" },
  { permission: "leases:read", description: "View lease agreements" },
  { permission: "leases:write", description: "Create and modify leases" },
  { permission: "tenants:read", description: "View tenant information" },
  { permission: "tenants:write", description: "Manage tenant records" },
  { permission: "team:read", description: "View team members" },
  { permission: "team:write", description: "Invite and manage team members" },
  { permission: "reports:read", description: "Access reports and analytics" },
  { permission: "ledger:read", description: "View ledger entries" },
];

export default function RBACPage() {
  return (
    <DocLayout
      title="Roles & Permissions"
      description="DoorStax enforces role-based access control (RBAC) across 4 permission layers with 7 distinct user roles."
      breadcrumbs={[
        { label: "Docs", href: "/" },
        { label: "Guides" },
        { label: "RBAC & Security" },
      ]}
    >
      {/* Overview */}
      <h2>Overview</h2>
      <p className="text-text-secondary mb-6 leading-relaxed">
        Access control in DoorStax is enforced through four layers that work
        together to ensure users can only access the resources they are
        authorized for.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        {[
          { num: "1", title: "Role Assignment", desc: "Each user is assigned exactly one role" },
          { num: "2", title: "Permission Mapping", desc: "Each role maps to a set of permission strings" },
          { num: "3", title: "Resource Scoping", desc: "Permissions are scoped to owned/assigned resources" },
          { num: "4", title: "API Enforcement", desc: "Every API route checks permissions before execution" },
        ].map((layer) => (
          <div key={layer.num} className="p-4 rounded-lg bg-bg-card border border-border">
            <div className="flex items-center gap-3 mb-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-md bg-accent-purple/10 text-accent-purple text-xs font-bold">
                {layer.num}
              </span>
              <span className="text-sm font-semibold text-text-primary">{layer.title}</span>
            </div>
            <p className="text-sm text-text-muted">{layer.desc}</p>
          </div>
        ))}
      </div>

      {/* Roles */}
      <h2>User Roles</h2>
      <div className="space-y-4 mb-8">
        {roles.map((role) => (
          <div
            key={role.badge}
            className={`rounded-xl bg-bg-card border ${role.border} overflow-hidden`}
          >
            <div className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <h3 className={`text-base font-semibold ${role.color}`}>
                  {role.name}
                </h3>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${role.bg} ${role.color} border ${role.border}`}>
                  {role.badge}
                </span>
              </div>
              <p className="text-sm text-text-secondary mb-4">{role.description}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                    Permissions
                  </h4>
                  <ul className="space-y-1">
                    {role.permissions.map((perm, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                        <span className="text-accent-green mt-1 text-xs">+</span>
                        <span className="font-mono text-xs">{perm}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                    Restrictions
                  </h4>
                  <ul className="space-y-1">
                    {role.restrictions.map((rest, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                        <span className="text-accent-red mt-1 text-xs">-</span>
                        <span>{rest}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Admin Permissions Table */}
      <h2>Admin Permissions</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        Admin-level permissions are prefixed with <code className="text-accent-lavender bg-bg-card px-1.5 py-0.5 rounded text-xs">admin:</code> and
        are only available to Super Admin and Platform Admin roles.
      </p>
      <div className="overflow-x-auto mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-text-muted font-medium">Permission</th>
              <th className="text-left py-3 px-4 text-text-muted font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            {adminPermissions.map((p) => (
              <tr key={p.permission} className="border-b border-border/50">
                <td className="py-3 px-4 font-mono text-xs text-accent-lavender">{p.permission}</td>
                <td className="py-3 px-4 text-text-secondary">{p.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Team Permissions Table */}
      <h2>Team Permissions</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        Team-level permissions control access to resources within an
        organization. These are assigned based on role and further scoped by
        resource ownership.
      </p>
      <div className="overflow-x-auto mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-text-muted font-medium">Permission</th>
              <th className="text-left py-3 px-4 text-text-muted font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            {teamPermissions.map((p) => (
              <tr key={p.permission} className="border-b border-border/50">
                <td className="py-3 px-4 font-mono text-xs text-accent-lavender">{p.permission}</td>
                <td className="py-3 px-4 text-text-secondary">{p.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Permission Matrix */}
      <h2>Permission Matrix</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        Quick reference showing which permissions each role receives.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-text-muted font-medium">Permission</th>
              <th className="text-center py-3 px-2 text-text-muted font-medium text-xs">Super</th>
              <th className="text-center py-3 px-2 text-text-muted font-medium text-xs">Platform</th>
              <th className="text-center py-3 px-2 text-text-muted font-medium text-xs">Owner</th>
              <th className="text-center py-3 px-2 text-text-muted font-medium text-xs">PM</th>
              <th className="text-center py-3 px-2 text-text-muted font-medium text-xs">Acct</th>
              <th className="text-center py-3 px-2 text-text-muted font-medium text-xs">Tenant</th>
              <th className="text-center py-3 px-2 text-text-muted font-medium text-xs">Partner</th>
            </tr>
          </thead>
          <tbody>
            {[
              { perm: "admin:*",           vals: [true,  true,  false, false, false, false, false] },
              { perm: "properties:read",    vals: [true,  true,  true,  true,  false, false, false] },
              { perm: "properties:write",   vals: [true,  true,  true,  false, false, false, false] },
              { perm: "payments:read",      vals: [true,  true,  true,  true,  true,  true,  false] },
              { perm: "payments:write",     vals: [true,  true,  true,  true,  false, true,  false] },
              { perm: "payouts:read",       vals: [true,  true,  true,  false, true,  false, false] },
              { perm: "payouts:write",      vals: [true,  true,  true,  false, false, false, false] },
              { perm: "leases:read",        vals: [true,  true,  true,  true,  false, true,  false] },
              { perm: "leases:write",       vals: [true,  true,  true,  true,  false, false, false] },
              { perm: "tenants:read",       vals: [true,  true,  true,  true,  false, false, false] },
              { perm: "tenants:write",      vals: [true,  true,  true,  true,  false, false, false] },
              { perm: "team:read",          vals: [true,  true,  true,  false, false, false, false] },
              { perm: "team:write",         vals: [true,  true,  true,  false, false, false, false] },
              { perm: "reports:read",       vals: [true,  true,  true,  false, true,  false, false] },
              { perm: "ledger:read",        vals: [true,  true,  true,  false, true,  false, false] },
            ].map((row) => (
              <tr key={row.perm} className="border-b border-border/50">
                <td className="py-2.5 px-4 font-mono text-xs text-accent-lavender">{row.perm}</td>
                {row.vals.map((v, i) => (
                  <td key={i} className="py-2.5 px-2 text-center">
                    {v ? (
                      <span className="text-accent-green text-xs font-bold">&#10003;</span>
                    ) : (
                      <span className="text-text-muted text-xs">&#8212;</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DocLayout>
  );
}

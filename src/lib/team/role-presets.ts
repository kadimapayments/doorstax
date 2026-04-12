/**
 * Role presets for team member invitation.
 * When a PM selects a role, the corresponding permissions are pre-filled.
 * The PM can then customize individual toggles before inviting.
 */
export interface RolePreset {
  label: string;
  description: string;
  permissions: Record<string, boolean>;
}

export const ROLE_PRESETS: Record<string, RolePreset> = {
  LEASING_AGENT: {
    label: "Leasing Agent",
    description:
      "Manage applications, showings, and tenant onboarding",
    permissions: {
      canViewFinancials: false,
      canManagePayments: false,
      canManageTenants: true,
      canManageUnits: true,
      canManageLeases: true,
      canManageMaintenance: false,
      canManageApplications: true,
      canViewReports: false,
      canManageSettings: false,
    },
  },
  ASSISTANT_PM: {
    label: "Assistant PM",
    description:
      "Full access to operations except settings and financials",
    permissions: {
      canViewFinancials: false,
      canManagePayments: true,
      canManageTenants: true,
      canManageUnits: true,
      canManageLeases: true,
      canManageMaintenance: true,
      canManageApplications: true,
      canViewReports: true,
      canManageSettings: false,
    },
  },
  REGIONAL_MANAGER: {
    label: "Regional Manager",
    description:
      "Full access including financials for assigned properties",
    permissions: {
      canViewFinancials: true,
      canManagePayments: true,
      canManageTenants: true,
      canManageUnits: true,
      canManageLeases: true,
      canManageMaintenance: true,
      canManageApplications: true,
      canViewReports: true,
      canManageSettings: false,
    },
  },
  MANAGER: {
    label: "Property Manager",
    description: "Manage properties, tenants, leases, and payments",
    permissions: {
      canViewFinancials: false,
      canManagePayments: true,
      canManageTenants: true,
      canManageUnits: true,
      canManageLeases: true,
      canManageMaintenance: true,
      canManageApplications: true,
      canViewReports: true,
      canManageSettings: false,
    },
  },
  ACCOUNTING: {
    label: "Accountant",
    description: "View financials, reports, and accounting data",
    permissions: {
      canViewFinancials: true,
      canManagePayments: false,
      canManageTenants: false,
      canManageUnits: false,
      canManageLeases: false,
      canManageMaintenance: false,
      canManageApplications: false,
      canViewReports: true,
      canManageSettings: false,
    },
  },
  CARETAKER: {
    label: "Caretaker",
    description: "View properties and manage maintenance requests",
    permissions: {
      canViewFinancials: false,
      canManagePayments: false,
      canManageTenants: false,
      canManageUnits: true,
      canManageLeases: false,
      canManageMaintenance: true,
      canManageApplications: false,
      canViewReports: false,
      canManageSettings: false,
    },
  },
  SERVICE_TECH: {
    label: "Service Tech",
    description:
      "View and manage assigned maintenance tickets only",
    permissions: {
      canViewFinancials: false,
      canManagePayments: false,
      canManageTenants: false,
      canManageUnits: false,
      canManageLeases: false,
      canManageMaintenance: true,
      canManageApplications: false,
      canViewReports: false,
      canManageSettings: false,
    },
  },
  STAFF: {
    label: "General Staff",
    description: "Basic access to tenants, units, and maintenance",
    permissions: {
      canViewFinancials: false,
      canManagePayments: false,
      canManageTenants: true,
      canManageUnits: true,
      canManageLeases: true,
      canManageMaintenance: true,
      canManageApplications: false,
      canViewReports: false,
      canManageSettings: false,
    },
  },
};

/** Human-readable labels for the permission boolean fields. */
export const PERMISSION_LABELS: Record<string, string> = {
  canViewFinancials: "View financials & accounting",
  canManagePayments: "Manage payments & charges",
  canManageTenants: "Manage tenants",
  canManageUnits: "Manage units & properties",
  canManageLeases: "Manage leases",
  canManageMaintenance: "Manage maintenance",
  canManageApplications: "Manage applications",
  canViewReports: "View reports",
  canManageSettings: "Manage settings",
};

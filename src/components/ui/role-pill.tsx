import type { Role } from "@prisma/client";

/**
 * Role-colored pill rendered next to the DoorStax wordmark in every
 * dashboard sidebar / nav. One source of truth for the color map so
 * admin / PM / landlord / tenant / owner / partner / vendor navs all
 * stay visually consistent.
 *
 * Color choices:
 *   ADMIN     — primary (theme purple)
 *   PM        — emerald (green)
 *   LANDLORD  — blue
 *   TENANT    — yellow
 *   OWNER     — teal
 *   PARTNER   — indigo
 *   VENDOR    — orange
 *
 * Uses /15 opacity backgrounds + dark-mode-aware text colors so the
 * pills hit WCAG contrast on both themes. Mirrors the visual recipe
 * the original Admin pill used (`bg-primary/15 text-primary`).
 */

interface RoleStyle {
  bg: string;
  text: string;
  label: string;
}

const ROLE_STYLES: Record<Role, RoleStyle> = {
  ADMIN: {
    bg: "bg-primary/15",
    text: "text-primary",
    label: "Admin",
  },
  PM: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-600 dark:text-emerald-400",
    label: "PM",
  },
  LANDLORD: {
    bg: "bg-blue-500/15",
    text: "text-blue-600 dark:text-blue-400",
    label: "Landlord",
  },
  TENANT: {
    bg: "bg-yellow-500/15",
    text: "text-yellow-700 dark:text-yellow-400",
    label: "Tenant",
  },
  OWNER: {
    bg: "bg-teal-500/15",
    text: "text-teal-600 dark:text-teal-400",
    label: "Owner",
  },
  PARTNER: {
    bg: "bg-indigo-500/15",
    text: "text-indigo-600 dark:text-indigo-400",
    label: "Partner",
  },
  VENDOR: {
    bg: "bg-orange-500/15",
    text: "text-orange-600 dark:text-orange-400",
    label: "Vendor",
  },
};

export function RolePill({
  role,
  className = "",
}: {
  role: Role | null | undefined;
  className?: string;
}) {
  if (!role) return null;
  const style = ROLE_STYLES[role];
  if (!style) return null;
  return (
    <span
      className={`rounded ${style.bg} px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${style.text} ${className}`}
    >
      {style.label}
    </span>
  );
}

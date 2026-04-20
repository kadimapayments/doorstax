"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  Building2,
  TrendingUp,
  ShieldAlert,
  Users,
  CreditCard,
  Receipt,
  Percent,
  FileText,
  UserCog,
  Globe,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Briefcase,
  DollarSign,
  LineChart,
  Wrench,
  Bell,
  Palette,
  Network,
  ClipboardList,
  Calculator,
  Server,
  Flame,
  FileSignature,
  ShieldCheck,
  LifeBuoy,
  Target,
  BookOpen,
  ClipboardCheck,
  Settings,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────
export interface AdminNavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
}

export interface AdminNavGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: AdminNavItem[];
}

export type AdminSidebarEntry = AdminNavItem | AdminNavGroup;

function isGroup(entry: AdminSidebarEntry): entry is AdminNavGroup {
  return "items" in entry;
}

// ─── Grouped admin sidebar definition ──────────────
export const adminSidebarEntries: AdminSidebarEntry[] = [
  // Top-level (always visible, no group)
  { label: "Overview", href: "/admin", icon: LayoutDashboard, permission: "admin:overview" },
  { label: "Add User", href: "/admin/users/new", icon: UserCog, permission: "admin:landlords" },
  { label: "Property Managers", href: "/admin/merchants", icon: Building2, permission: "admin:landlords" },
  { label: "Leads", href: "/admin/leads", icon: Flame, permission: "admin:leads" },
  { label: "Proposals", href: "/admin/proposals", icon: FileText, permission: "admin:overview" },
  // Operations
  {
    label: "Operations",
    icon: Briefcase,
    items: [
      { label: "Terminal Queue", href: "/admin/terminal-requests", icon: Server, permission: "admin:landlords" },
      { label: "Property Reviews", href: "/admin/property-reviews", icon: ClipboardCheck, permission: "admin:landlords" },
      { label: "Tenants", href: "/admin/tenants", icon: Users, permission: "admin:tenants" },
      { label: "Properties", href: "/admin/properties", icon: Building2, permission: "admin:properties" },
      { label: "Listings", href: "/admin/listings", icon: Globe, permission: "admin:properties" },
      { label: "Leases", href: "/admin/leases", icon: FileSignature, permission: "admin:leases" },
      { label: "Applications", href: "/admin/applications", icon: ClipboardList, permission: "admin:applications" },
      { label: "Screenings", href: "/admin/screenings", icon: ShieldCheck, permission: "admin:applications" },
      { label: "Tickets", href: "/admin/tickets", icon: LifeBuoy, permission: "admin:tickets" },
    ],
  },
  // Finance
  {
    label: "Finance",
    icon: DollarSign,
    items: [
      { label: "Payments", href: "/admin/payments", icon: CreditCard, permission: "admin:payments" },
      { label: "Virtual Terminal", href: "/admin/virtual-terminal", icon: CreditCard, permission: "admin:payments" },
      { label: "Expenses", href: "/admin/expenses", icon: Receipt, permission: "admin:expenses" },
      { label: "Earnings", href: "/admin/residuals", icon: Percent, permission: "admin:expenses" },
      { label: "Billing", href: "/admin/billing", icon: Receipt, permission: "admin:expenses" },
      { label: "Discounts", href: "/admin/discounts", icon: Percent, permission: "admin:expenses" },
      { label: "Statements", href: "/admin/statements", icon: FileText, permission: "admin:expenses" },
    ],
  },
  // Analytics
  {
    label: "Analytics",
    icon: LineChart,
    items: [
      { label: "Volume", href: "/admin/volume", icon: TrendingUp, permission: "admin:volume" },
      { label: "Risk", href: "/admin/risk", icon: ShieldAlert, permission: "admin:risk" },
      { label: "Insights", href: "/admin/insights", icon: Target, permission: "admin:insights" },
    ],
  },
  // Management
  {
    label: "Management",
    icon: Wrench,
    items: [
      { label: "Staff", href: "/admin/staff", icon: UserCog, permission: "admin:staff" },
      { label: "White Label", href: "/admin/white-label", icon: Palette, permission: "admin:staff" },
      { label: "Agent Network", href: "/admin/agents", icon: Network, permission: "admin:staff" },
      { label: "Profit Calculator", href: "/admin/calculator", icon: Calculator, permission: "admin:overview" },
      { label: "Knowledge Base", href: "/admin/knowledge", icon: BookOpen, permission: "admin:overview" },
      { label: "Audit Log", href: "/admin/audit-logs", icon: ClipboardCheck, permission: "admin:audit" },
      { label: "Notifications", href: "/admin/notifications", icon: Bell, permission: "admin:overview" },
    ],
  },
];

// ─── Legacy flat exports ───────────────────────────
export const adminNavItems: AdminNavItem[] = adminSidebarEntries.flatMap((entry) =>
  isGroup(entry) ? entry.items : [entry]
);

/** Filter admin nav items by permissions. ["*"] = show all. */
export function filterAdminItems(items: AdminNavItem[], permissions: string[]): AdminNavItem[] {
  if (permissions.includes("*")) return items;
  return items.filter(
    (item) => !item.permission || permissions.includes(item.permission)
  );
}

/** Filter admin sidebar entries (groups + standalone) by permissions. */
function filterEntries(entries: AdminSidebarEntry[], permissions: string[]): AdminSidebarEntry[] {
  if (permissions.includes("*")) return entries;
  return entries
    .map((entry) => {
      if (isGroup(entry)) {
        const filtered = entry.items.filter(
          (item) => !item.permission || permissions.includes(item.permission)
        );
        return filtered.length > 0 ? { ...entry, items: filtered } : null;
      }
      if (!entry.permission || permissions.includes(entry.permission)) return entry;
      return null;
    })
    .filter(Boolean) as AdminSidebarEntry[];
}

// ─── AdminNav Component ───────────────────────────
interface AdminNavProps {
  permissions?: string[];
}

export function AdminNav({ permissions = ["*"] }: AdminNavProps) {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();
  const visibleEntries = filterEntries(adminSidebarEntries, permissions);

  // Track which groups are open — always start collapsed, no localStorage
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {};
    adminSidebarEntries.forEach((e) => {
      if (isGroup(e)) defaults[e.label] = false;
    });
    return defaults;
  });

  const toggleGroup = useCallback((label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  }, []);

  const isItemActive = (href: string) =>
    pathname === href || (href !== "/admin" && pathname.startsWith(href + "/"));

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden lg:flex flex-col border-r border-border bg-background transition-all duration-200",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo + Admin badge + Toggle */}
      <div className="flex h-16 items-center justify-between px-3">
        <Link href="/admin" className={cn("flex items-center", collapsed ? "justify-center w-full" : "gap-2 px-3")}>
          {collapsed ? (
            <Image src="/doorstax-emblem.svg" alt="DoorStax" width={24} height={24} priority />
          ) : (
            <>
              <Image src="/logo-dark.svg" alt="DoorStax" width={140} height={32} priority className="dark:hidden" />
              <Image src="/logo-white.svg" alt="DoorStax" width={140} height={32} priority className="hidden dark:block" />
              <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">Admin</span>
            </>
          )}
        </Link>
        {!collapsed && (
          <button
            onClick={toggle}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <div className="flex justify-center pb-1">
          <button
            onClick={toggle}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className={cn("flex-1 py-2 overflow-y-auto", collapsed ? "px-2" : "px-3")}>
        {visibleEntries.map((entry) => {
          if (isGroup(entry)) {
            const isOpen = openGroups[entry.label] ?? false;
            const groupHasActive = entry.items.some((item) => isItemActive(item.href));

            if (collapsed) {
              return (
                <DropdownMenu key={entry.label}>
                  <DropdownMenuTrigger asChild>
                    <button
                      title={entry.label}
                      className={cn(
                        "flex w-full items-center justify-center rounded-lg py-2.5 text-sm font-medium transition-colors mb-0.5",
                        groupHasActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <entry.icon className="h-4 w-4 shrink-0" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="start" className="min-w-[180px]">
                    {entry.items.map((item) => {
                      const active = isItemActive(item.href);
                      return (
                        <DropdownMenuItem key={item.href} asChild>
                          <Link
                            href={item.href}
                            className={cn(
                              "flex items-center gap-2",
                              active && "font-semibold text-primary"
                            )}
                          >
                            <item.icon className="h-4 w-4" />
                            {item.label}
                          </Link>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            }

            return (
              <div key={entry.label} className="mb-1">
                <button
                  onClick={() => toggleGroup(entry.label)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors",
                    groupHasActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <entry.icon className="h-3.5 w-3.5" />
                    {entry.label}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 transition-transform duration-200",
                      !isOpen && "-rotate-90"
                    )}
                  />
                </button>
                <div
                  className={cn(
                    "overflow-hidden transition-all duration-200",
                    isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                  )}
                >
                  <div className="space-y-0.5 pl-2">
                    {entry.items.map((item) => {
                      const active = isItemActive(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "nav-item-hover flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                            active
                              ? "active bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          }

          const active = isItemActive(entry.href);
          return (
            <Link
              key={entry.href}
              href={entry.href}
              title={collapsed ? entry.label : undefined}
              className={cn(
                "nav-item-hover flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors mb-1",
                collapsed ? "justify-center px-0" : "gap-3 px-3",
                active
                  ? "active bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <entry.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{entry.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Settings icon ABOVE the border line when collapsed */}
      {collapsed && (
        <div className="flex justify-center pb-2">
          <Link
            href="/admin/settings"
            title="Settings"
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
              pathname.startsWith("/admin/settings")
                ? "text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      )}

      {/* Footer — Kadima Internal */}
      <div className={cn("border-t border-border", collapsed ? "p-2" : "p-4")}>
        {collapsed ? (
          <div className="flex justify-center">
            <a
              href="https://kadimapayments.com"
              target="_blank"
              rel="noopener noreferrer"
              title="Kadima Internal"
              className="flex h-7 w-7 items-center justify-center"
            >
              <Image src="/kadima-emblem-black.svg" alt="Kadima Payments" width={24} height={24} className="dark:hidden" />
              <Image src="/kadima-emblem-white.svg" alt="Kadima Payments" width={24} height={24} className="hidden dark:block" />
            </a>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-1.5 text-[10px] text-muted-foreground">Kadima Internal</p>
              <a href="https://kadimapayments.com" target="_blank" rel="noopener noreferrer">
                <Image src="/kadima-logo-dark.svg" alt="Kadima Payments" width={72} height={15} className="dark:hidden" />
                <Image src="/kadima-logo-white.svg" alt="Kadima Payments" width={72} height={15} className="hidden dark:block" />
              </a>
            </div>
            <Link
              href="/admin/settings"
              title="Settings"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                pathname.startsWith("/admin/settings")
                  ? "text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Settings className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}

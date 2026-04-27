"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar-context";
import { RolePill } from "@/components/ui/role-pill";
import type { Role } from "@prisma/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  CreditCard,
  BarChart3,
  Settings,
  Globe,
  Ticket,
  TrendingUp,
  Percent,
  MessageSquare,
  ScrollText,
  Receipt,
  HelpCircle,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  UserCheck,
  Send,
  ClipboardList,
  Briefcase,
  KeyRound,
  DollarSign,
  LineChart,
  LifeBuoy,
  Search,
  Wrench,
  ClipboardCheck,
  ArrowRightLeft,
  Bell,
  UserPlus,
  Calculator,
  Sparkles,
  Lock,
  AlertTriangle,
  CalendarDays,
  BookOpen,
  Car,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────
export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  monetize?: boolean;
}

export interface NavGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

export type SidebarEntry = NavItem | NavGroup;

function isGroup(entry: SidebarEntry): entry is NavGroup {
  return "items" in entry;
}

// ─── Grouped sidebar definition ────────────────────
export const sidebarEntries: SidebarEntry[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
  { label: "Calendar", href: "/dashboard/calendar", icon: CalendarDays },
  {
    label: "Portfolio",
    icon: Briefcase,
    items: [
      { label: "Owners", href: "/dashboard/owners", icon: UserCheck, permission: "properties:read" },
      { label: "Properties", href: "/dashboard/properties", icon: Building2, permission: "properties:read" },
      { label: "Tenants", href: "/dashboard/tenants", icon: Users, permission: "tenants:read" },
      { label: "Vendors", href: "/dashboard/vendors", icon: Wrench, permission: "properties:read" },
      { label: "Listings", href: "/dashboard/listings", icon: Globe, permission: "listings:read" },
      { label: "Parking", href: "/dashboard/parking", icon: Car, permission: "properties:read" },
      { label: "Inspections", href: "/dashboard/inspections", icon: ClipboardCheck, permission: "properties:read" },
      { label: "Team", href: "/dashboard/team", icon: Users, permission: "team:read" },
    ],
  },
  {
    label: "Leasing",
    icon: KeyRound,
    items: [
      { label: "Leads", href: "/dashboard/leads", icon: ClipboardList, permission: "leads:read" },
      { label: "Applications", href: "/dashboard/applications", icon: FileText, permission: "applications:read" },
      { label: "Leases", href: "/dashboard/leases", icon: ScrollText, permission: "leases:read" },
      { label: "Evictions", href: "/dashboard/evictions", icon: AlertTriangle },
      { label: "Screening", href: "/dashboard/screening", icon: Search, permission: "applications:read" },
    ],
  },
  {
    label: "Finance",
    icon: DollarSign,
    items: [
      { label: "Payments", href: "/dashboard/payments", icon: CreditCard, permission: "payments:read" },
      { label: "Virtual Terminal", href: "/dashboard/virtual-terminal", icon: CreditCard, permission: "payments:read" },
      { label: "Unpaid Rent", href: "/dashboard/unpaid", icon: AlertTriangle, permission: "payments:read" },
      { label: "Delinquency", href: "/dashboard/delinquency", icon: LifeBuoy, permission: "payments:read" },
      { label: "Payouts", href: "/dashboard/payouts", icon: Send, permission: "payments:read" },
      { label: "Expenses", href: "/dashboard/expenses", icon: Receipt, permission: "expenses:read" },
      { label: "Vendor Invoices", href: "/dashboard/vendor-invoices", icon: Receipt, permission: "expenses:read" },
      { label: "Statements", href: "/dashboard/statements", icon: FileText, permission: "payments:read" },
      { label: "Tax Center", href: "/dashboard/tax-center", icon: Calculator, permission: "payments:read" },
      { label: "Billing", href: "/dashboard/billing", icon: Receipt, permission: "payments:read" },
    ],
  },
  {
    label: "Monetize",
    icon: Sparkles,
    items: [
      { label: "Fee Schedules", href: "/dashboard/fee-schedules", icon: ClipboardList, permission: "properties:read", monetize: true },
      { label: "Earnings", href: "/dashboard/residuals", icon: Percent, permission: "payments:read", monetize: true },
    ],
  },
  { label: "Accounting", href: "/dashboard/accounting", icon: BookOpen, permission: "payments:read" },
  {
    label: "Analytics",
    icon: LineChart,
    items: [
      { label: "Reports", href: "/dashboard/reports", icon: BarChart3, permission: "reports:read" },
      { label: "Performance", href: "/dashboard/performance", icon: TrendingUp, permission: "reports:read" },
      { label: "Risk", href: "/dashboard/risk", icon: ShieldAlert, permission: "payments:read" },
    ],
  },
  {
    label: "Support",
    icon: LifeBuoy,
    items: [
      { label: "Tickets", href: "/dashboard/tickets", icon: Ticket, permission: "tickets:read" },
      { label: "Messages", href: "/dashboard/messages", icon: MessageSquare },
      { label: "Help", href: "/dashboard/help", icon: HelpCircle },
      { label: "Switch to DoorStax", href: "/dashboard/migrate", icon: ArrowRightLeft },
    ],
  },
];

// ─── Legacy flat export (used by mobile-nav, etc) ──
export const navItems: NavItem[] = sidebarEntries.flatMap((entry) =>
  isGroup(entry) ? entry.items : [entry]
);

/** Filter nav items by permissions. ["*"] = show all. */
export function filterItems(items: NavItem[], permissions: string[]): NavItem[] {
  if (permissions.includes("*")) return items;
  return items.filter(
    (item) => !item.permission || permissions.includes(item.permission)
  );
}

/** Filter sidebar entries (groups + standalone) by permissions. */
function filterEntries(entries: SidebarEntry[], permissions: string[]): SidebarEntry[] {
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
    .filter(Boolean) as SidebarEntry[];
}

// ─── Sidebar Component ────────────────────────────
interface SidebarProps {
  permissions?: string[];
  unitCount?: number;
  onboardingComplete?: boolean;
  /**
   * Logged-in user's role. Drives the colored pill rendered next to
   * the wordmark. Undefined / null → no pill (falls back to legacy
   * "logo only" header).
   */
  role?: Role | null;
}

// Routes accessible during Guided Launch Mode
const ONBOARDING_ALLOWED_HREFS = new Set([
  "/dashboard",
  "/dashboard/properties",
  "/dashboard/tenants",
  "/dashboard/onboarding",
  "/dashboard/settings",
  "/dashboard/migrate",
]);

export function Sidebar({ permissions = ["*"], unitCount = 0, onboardingComplete = true, role }: SidebarProps) {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();
  const visibleEntries = filterEntries(sidebarEntries, permissions);

  // Track which groups are open — always start collapsed, no localStorage
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {};
    sidebarEntries.forEach((e) => {
      if (isGroup(e)) defaults[e.label] = false;
    });
    return defaults;
  });

  const toggleGroup = useCallback((label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  }, []);

  const isItemActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden lg:flex flex-col border-r border-border bg-background transition-all duration-200",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo + Toggle */}
      <div className="flex h-16 items-center justify-between px-3">
        <Link href="/dashboard" className={cn("flex items-center", collapsed ? "justify-center w-full" : "gap-2 px-3")}>
          {collapsed ? (
            <Image src="/doorstax-emblem.svg" alt="DoorStax" width={24} height={24} priority />
          ) : (
            <>
              <Image src="/logo-dark.svg" alt="DoorStax" width={140} height={32} priority className="dark:hidden" />
              <Image src="/logo-white.svg" alt="DoorStax" width={140} height={32} priority className="hidden dark:block" />
              {role && <RolePill role={role} />}
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
              // Collapsed: show group icon with dropdown menu
              return (
                <DropdownMenu key={entry.label}>
                  <DropdownMenuTrigger asChild>
                    <button
                      title={entry.label}
                      className={cn(
                        "flex w-full items-center justify-center rounded-lg py-2.5 text-sm font-medium transition-colors mb-0.5",
                        groupHasActive
                          ? "bg-primary/10 text-primary dark:bg-gradient-to-r dark:from-primary/15 dark:to-transparent"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <entry.icon className="h-4 w-4 shrink-0" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="start" className="min-w-[180px]">
                    {entry.items.map((item) => {
                      const active = isItemActive(item.href);
                      const onboardingLocked = !onboardingComplete && !ONBOARDING_ALLOWED_HREFS.has(item.href);

                      if (onboardingLocked) {
                        return (
                          <DropdownMenuItem key={item.href} disabled className="flex items-center gap-2 opacity-50">
                            <item.icon className="h-4 w-4" />
                            {item.label}
                            <Lock className="ml-auto h-3 w-3" />
                          </DropdownMenuItem>
                        );
                      }

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

            // Expanded: collapsible group
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
                      const onboardingLocked = !onboardingComplete && !ONBOARDING_ALLOWED_HREFS.has(item.href);
                      const showLock = (item.monetize && unitCount < 100) || onboardingLocked;

                      if (onboardingLocked) {
                        return (
                          <span
                            key={item.href}
                            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium cursor-not-allowed opacity-50 text-muted-foreground"
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span>{item.label}</span>
                            <Lock className="ml-auto h-3 w-3 text-muted-foreground/50" />
                          </span>
                        );
                      }

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          data-tour-target={
                            item.href === "/dashboard/properties" ? "properties" :
                            item.href === "/dashboard/tenants" ? "tenants" :
                            item.href === "/dashboard/onboarding" ? "onboarding" :
                            item.href === "/dashboard/migrate" ? "migrate" :
                            undefined
                          }
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                            active
                              ? "bg-primary/10 text-primary dark:bg-gradient-to-r dark:from-primary/15 dark:to-transparent"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span>{item.label}</span>
                          {showLock && <Lock className="ml-auto h-3 w-3 text-muted-foreground/50" />}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          }

          // Standalone item (Overview, Notifications, Calendar)
          const active = isItemActive(entry.href);
          const onboardingLocked = !onboardingComplete && !ONBOARDING_ALLOWED_HREFS.has(entry.href);

          if (onboardingLocked) {
            return (
              <span
                key={entry.href}
                title={collapsed ? entry.label : undefined}
                className={cn(
                  "flex items-center rounded-lg py-2.5 text-sm font-medium mb-1 cursor-not-allowed opacity-50 text-muted-foreground",
                  collapsed ? "justify-center px-0" : "gap-3 px-3"
                )}
              >
                <entry.icon className="h-4 w-4 shrink-0" />
                {!collapsed && (
                  <>
                    <span>{entry.label}</span>
                    <Lock className="ml-auto h-3 w-3 text-muted-foreground/50" />
                  </>
                )}
              </span>
            );
          }

          return (
            <Link
              key={entry.href}
              href={entry.href}
              title={collapsed ? entry.label : undefined}
              className={cn(
                "flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors mb-1",
                collapsed ? "justify-center px-0" : "gap-3 px-3",
                active
                  ? "bg-primary/10 text-primary dark:bg-gradient-to-r dark:from-primary/15 dark:to-transparent"
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
            href="/dashboard/settings"
            title="Settings"
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
              pathname.startsWith("/dashboard/settings")
                ? "text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      )}

      {/* Footer — Kadima branding */}
      <div className={cn("border-t border-border", collapsed ? "p-2" : "p-4")}>
        {collapsed ? (
          <div className="flex justify-center">
            <a
              href="https://kadimapayments.com"
              target="_blank"
              rel="noopener noreferrer"
              title="Powered by Kadima Payments"
              className="flex h-7 w-7 items-center justify-center"
            >
              <Image src="/kadima-emblem-black.svg" alt="Kadima Payments" width={24} height={24} className="dark:hidden" />
              <Image src="/kadima-emblem-white.svg" alt="Kadima Payments" width={24} height={24} className="hidden dark:block" />
            </a>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-1.5 text-[10px] text-muted-foreground">Powered by</p>
              <a href="https://kadimapayments.com" target="_blank" rel="noopener noreferrer">
                <Image src="/kadima-logo-dark.svg" alt="Kadima Payments" width={72} height={15} className="dark:hidden" />
                <Image src="/kadima-logo-white.svg" alt="Kadima Payments" width={72} height={15} className="hidden dark:block" />
              </a>
            </div>
            <Link
              href="/dashboard/settings"
              title="Settings"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                pathname.startsWith("/dashboard/settings")
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

"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar-context";
import {
  LayoutDashboard,
  CreditCard,
  History,
  RefreshCw,
  Settings,
  Ticket,
  FileText,
  MessageSquare,
  HelpCircle,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Bell,
  FolderOpen,
  CalendarDays,
} from "lucide-react";

export const navItems = [
  { label: "Dashboard", href: "/tenant", icon: LayoutDashboard },
  { label: "Calendar", href: "/tenant/calendar", icon: CalendarDays },
  { label: "Payments", href: "/tenant/pay", icon: CreditCard },
  { label: "Autopay", href: "/tenant/autopay", icon: RefreshCw },
  { label: "History", href: "/tenant/history", icon: History },
  { label: "Reports", href: "/tenant/reports", icon: FileText },
  { label: "Rent Profile", href: "/tenant/rent-profile", icon: TrendingUp },
  { label: "Documents", href: "/tenant/documents", icon: FolderOpen },
  { label: "Lease", href: "/tenant/leases", icon: FileText },
  { label: "Tickets", href: "/tenant/tickets", icon: Ticket },
  { label: "Messages", href: "/tenant/messages", icon: MessageSquare },
  { label: "Notifications", href: "/tenant/notifications", icon: Bell },
  { label: "Help", href: "/tenant/help", icon: HelpCircle },
  { label: "Credit", href: "/tenant/credit", icon: TrendingUp },
];

export function TenantNav() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden lg:flex flex-col border-r border-border bg-background transition-all duration-200",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo + Toggle */}
      <div className="flex h-16 items-center justify-between px-3">
        <Link href="/tenant" className={cn("flex items-center", collapsed ? "justify-center w-full" : "px-3")}>
          {collapsed ? (
            <Image src="/doorstax-emblem.svg" alt="DoorStax" width={24} height={24} priority />
          ) : (
            <>
              <Image src="/logo-dark.svg" alt="DoorStax" width={140} height={32} priority className="dark:hidden" />
              <Image src="/logo-white.svg" alt="DoorStax" width={140} height={32} priority className="hidden dark:block" />
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
      <nav className={cn("flex-1 space-y-1 py-4 overflow-y-auto", collapsed ? "px-2" : "px-3")}>
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/tenant" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors",
                collapsed ? "justify-center px-0" : "gap-3 px-3",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Settings icon ABOVE the border line when collapsed */}
      {collapsed && (
        <div className="flex justify-center pb-2">
          <Link
            href="/tenant/settings"
            title="Settings"
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
              pathname.startsWith("/tenant/settings")
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
              href="/tenant/settings"
              title="Settings"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                pathname.startsWith("/tenant/settings")
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

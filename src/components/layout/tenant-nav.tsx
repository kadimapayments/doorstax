"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CreditCard,
  History,
  RefreshCw,
  Settings,
  Ticket,
  FileText,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/tenant", icon: LayoutDashboard },
  { label: "Pay Rent", href: "/tenant/pay", icon: CreditCard },
  { label: "Autopay", href: "/tenant/autopay", icon: RefreshCw },
  { label: "History", href: "/tenant/history", icon: History },
  { label: "Reports", href: "/tenant/reports", icon: FileText },
  { label: "Tickets", href: "/tenant/tickets", icon: Ticket },
  { label: "Settings", href: "/tenant/settings", icon: Settings },
];

export function TenantNav() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-border bg-background">
      <div className="flex h-16 items-center px-6">
        <Link href="/tenant">
          <Image src="/logo-dark.svg" alt="DoorStax" width={140} height={32} priority className="dark:hidden" />
          <Image src="/logo-white.svg" alt="DoorStax" width={140} height={32} priority className="hidden dark:block" />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/tenant" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-4">
        <p className="mb-1.5 text-[10px] text-muted-foreground">Powered by</p>
        <a href="https://kadimapayments.com" target="_blank" rel="noopener noreferrer">
          <Image src="/kadima-logo-dark.svg" alt="Kadima Payments" width={72} height={15} className="dark:hidden" />
          <Image src="/kadima-logo-white.svg" alt="Kadima Payments" width={72} height={15} className="hidden dark:block" />
        </a>
      </div>
    </aside>
  );
}

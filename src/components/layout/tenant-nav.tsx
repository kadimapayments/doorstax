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
} from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/tenant", icon: LayoutDashboard },
  { label: "Pay Rent", href: "/tenant/pay", icon: CreditCard },
  { label: "Autopay", href: "/tenant/autopay", icon: RefreshCw },
  { label: "History", href: "/tenant/history", icon: History },
  { label: "Settings", href: "/tenant/settings", icon: Settings },
];

export function TenantNav() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-border bg-background">
      <div className="flex h-16 items-center px-6">
        <Link href="/tenant">
          <Image src="/logo-white.svg" alt="DoorStax" width={140} height={32} priority />
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
        <p className="text-xs text-muted-foreground">
          Powered by <span className="font-semibold text-secondary">Kadima</span>
        </p>
      </div>
    </aside>
  );
}

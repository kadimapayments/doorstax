"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
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
} from "lucide-react";

const navItems = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Properties", href: "/dashboard/properties", icon: Building2 },
  { label: "Tenants", href: "/dashboard/tenants", icon: Users },
  { label: "Applications", href: "/dashboard/applications", icon: FileText },
  { label: "Listings", href: "/dashboard/listings", icon: Globe },
  { label: "Payments", href: "/dashboard/payments", icon: CreditCard },
  { label: "Tickets", href: "/dashboard/tickets", icon: Ticket },
  { label: "Reports", href: "/dashboard/reports", icon: BarChart3 },
  { label: "Performance", href: "/dashboard/performance", icon: TrendingUp },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-border bg-background">
      {/* Logo */}
      <div className="flex h-16 items-center px-6">
        <Link href="/dashboard">
          <Image src="/logo-dark.svg" alt="DoorStax" width={140} height={32} priority className="dark:hidden" />
          <Image src="/logo-white.svg" alt="DoorStax" width={140} height={32} priority className="hidden dark:block" />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
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

      {/* Footer */}
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

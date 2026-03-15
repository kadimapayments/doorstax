"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ChevronRight, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  adminSidebarEntries,
  filterAdminItems,
  type AdminSidebarEntry,
  type AdminNavGroup,
} from "@/components/layout/admin-nav";

function isGroup(entry: AdminSidebarEntry): entry is AdminNavGroup {
  return "items" in entry;
}

interface AdminMobileNavProps {
  permissions?: string[];
}

export function AdminMobileNav({ permissions = ["*"] }: AdminMobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const filteredEntries = permissions?.includes("*") || !permissions
    ? adminSidebarEntries
    : adminSidebarEntries
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

  const isActive = (href: string) =>
    pathname === href || (href !== "/admin" && pathname.startsWith(href + "/"));

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" className="lg:hidden h-9 gap-1.5 px-2">
          <Image src="/doorstax-emblem.svg" alt="DoorStax" width={20} height={20} />
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="sr-only">Open menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <div className="flex h-16 items-center px-6 border-b border-border">
          <Link href="/admin" onClick={() => setOpen(false)}>
            <Image src="/logo-dark.svg" alt="DoorStax" width={140} height={32} className="dark:hidden" />
            <Image src="/logo-white.svg" alt="DoorStax" width={140} height={32} className="hidden dark:block" />
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <div className="space-y-3">
            {filteredEntries.map((entry) => {
              if (isGroup(entry)) {
                return (
                  <div key={entry.label}>
                    <p className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <entry.icon className="h-3.5 w-3.5" />
                      {entry.label}
                    </p>
                    <div className="space-y-0.5 pl-2">
                      {entry.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                            isActive(item.href)
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              }
              return (
                <Link
                  key={entry.href}
                  href={entry.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive(entry.href)
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <entry.icon className="h-4 w-4" />
                  {entry.label}
                </Link>
              );
            })}
          </div>

          {/* Settings at bottom */}
          <div className="mt-4 border-t border-border pt-3">
            <Link
              href="/admin/settings"
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                pathname.startsWith("/admin/settings")
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}

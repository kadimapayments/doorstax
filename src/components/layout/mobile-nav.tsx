"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ChevronRight, ChevronDown, Settings, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  sidebarEntries,
  filterItems,
  type NavItem,
  type SidebarEntry,
  type NavGroup,
} from "@/components/layout/sidebar";

function isGroup(entry: SidebarEntry): entry is NavGroup {
  return "items" in entry;
}

// Routes accessible during Guided Launch Mode
const ONBOARDING_ALLOWED_HREFS = new Set([
  "/dashboard",
  "/dashboard/properties",
  "/dashboard/tenants",
  "/dashboard/onboarding",
  "/dashboard/settings",
]);

interface MobileNavProps {
  /** Items to render (flat list) — OR pass permissions and the component will use grouped entries. */
  items?: NavItem[];
  permissions?: string[];
  unitCount?: number;
  onboardingComplete?: boolean;
  logoHref?: string;
}

export function MobileNav({ items, permissions, unitCount = 0, onboardingComplete = true, logoHref = "/dashboard" }: MobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // Close sheet on navigation
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // If flat items are provided, use the legacy flat rendering
  const useFlatMode = !!items;
  const flatItems = items ?? [];

  // Filter grouped entries by permission
  const filteredEntries = !useFlatMode
    ? (permissions?.includes("*") || !permissions
      ? sidebarEntries
      : sidebarEntries
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
          .filter(Boolean) as SidebarEntry[])
    : [];

  const isActive = (href: string) =>
    pathname === href ||
    (href !== "/dashboard" && href !== "/tenant" && href !== "/admin" && pathname.startsWith(href + "/"));

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
          <Link href={logoHref} onClick={() => setOpen(false)}>
            <Image src="/logo-dark.svg" alt="DoorStax" width={140} height={32} className="dark:hidden" />
            <Image src="/logo-white.svg" alt="DoorStax" width={140} height={32} className="hidden dark:block" />
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {useFlatMode ? (
            /* Flat item rendering (legacy) */
            <div className="space-y-1">
              {flatItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive(item.href)
                      ? "bg-primary/10 text-primary dark:bg-gradient-to-r dark:from-primary/15 dark:to-transparent"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </div>
          ) : (
            /* Grouped rendering with collapsible groups */
            <div className="space-y-1">
              {filteredEntries.map((entry) => {
                if (isGroup(entry)) {
                  const isGroupOpen = openGroups[entry.label] ?? true;
                  const groupHasActive = entry.items.some((item) => isActive(item.href));
                  return (
                    <div key={entry.label}>
                      <button
                        onClick={() => setOpenGroups((prev) => ({ ...prev, [entry.label]: !isGroupOpen }))}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors",
                          groupHasActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <entry.icon className="h-3.5 w-3.5" />
                          {entry.label}
                        </span>
                        <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", !isGroupOpen && "-rotate-90")} />
                      </button>
                      <div className={cn("overflow-hidden transition-all duration-200", isGroupOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0")}>
                        <div className="space-y-0.5 pl-2">
                          {entry.items.map((item) => {
                            const onboardingLocked = !onboardingComplete && !ONBOARDING_ALLOWED_HREFS.has(item.href);
                            const showLock = (item.monetize && unitCount < 100) || onboardingLocked;

                            if (onboardingLocked) {
                              return (
                                <span
                                  key={item.href}
                                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium cursor-not-allowed opacity-50 text-muted-foreground"
                                >
                                  <item.icon className="h-4 w-4" />
                                  {item.label}
                                  <Lock className="ml-auto h-3 w-3 text-muted-foreground/50" />
                                </span>
                              );
                            }

                            return (
                              <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setOpen(false)}
                                className={cn(
                                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                                  isActive(item.href)
                                    ? "bg-primary/10 text-primary dark:bg-gradient-to-r dark:from-primary/15 dark:to-transparent"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                              >
                                <item.icon className="h-4 w-4" />
                                {item.label}
                                {showLock && <Lock className="ml-auto h-3 w-3 text-muted-foreground/50" />}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                }
                // Standalone item
                const standaloneOnboardingLocked = !onboardingComplete && !ONBOARDING_ALLOWED_HREFS.has(entry.href);

                if (standaloneOnboardingLocked) {
                  return (
                    <span
                      key={entry.href}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium cursor-not-allowed opacity-50 text-muted-foreground"
                    >
                      <entry.icon className="h-4 w-4" />
                      {entry.label}
                      <Lock className="ml-auto h-3 w-3 text-muted-foreground/50" />
                    </span>
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
                        ? "bg-primary/10 text-primary dark:bg-gradient-to-r dark:from-primary/15 dark:to-transparent"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <entry.icon className="h-4 w-4" />
                    {entry.label}
                  </Link>
                );
              })}
            </div>
          )}

          {/* Settings link at bottom */}
          <div className="mt-4 border-t border-border pt-3">
            <Link
              href={`${logoHref === "/dashboard" ? "/dashboard" : logoHref}/settings`}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                pathname.startsWith(`${logoHref}/settings`) || pathname.startsWith("/dashboard/settings")
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

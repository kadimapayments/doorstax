import Link from "next/link";
import Image from "next/image";
import {
  LogOut,
  LayoutDashboard,
  Wrench,
  Receipt,
  Wallet,
  FileText,
  User as UserIcon,
} from "lucide-react";
import { requireRole } from "@/lib/auth-utils";

/**
 * Vendor portal layout.
 *
 * Web-responsive — side nav on desktop collapses to a bottom bar on mobile.
 * Role is enforced both by middleware (/vendor/* → role === "VENDOR") and
 * here via requireRole.
 */

const NAV = [
  { href: "/vendor", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/vendor/tickets", label: "Tickets", icon: Wrench },
  { href: "/vendor/invoices", label: "Invoices", icon: Receipt },
  { href: "/vendor/payments", label: "Payments", icon: Wallet },
  { href: "/vendor/documents", label: "Documents", icon: FileText },
  { href: "/vendor/profile", label: "Profile", icon: UserIcon },
];

export default async function VendorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("VENDOR");

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop side nav + mobile top bar */}
      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex md:w-56 md:shrink-0 flex-col border-r bg-card">
          <div className="p-4 border-b">
            <Link href="/vendor" className="flex items-center gap-2">
              <Image
                src="/logo-white.svg"
                alt="DoorStax"
                width={110}
                height={24}
                priority
              />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Vendor
              </span>
            </Link>
          </div>
          <nav className="flex-1 p-3 space-y-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="nav-item-hover flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
          <div className="p-3 border-t space-y-1">
            <div className="px-3 py-2 text-xs text-muted-foreground">
              <div className="font-medium text-foreground truncate">
                {user.name || user.email}
              </div>
              <div className="truncate">{user.email}</div>
            </div>
            <Link
              href="/api/auth/signout"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Link>
          </div>
        </aside>

        {/* Mobile top bar */}
        <div className="md:hidden sticky top-0 z-40 w-full border-b bg-card/80 backdrop-blur-md">
          <div className="flex h-12 items-center justify-between px-4">
            <Link href="/vendor" className="flex items-center gap-2">
              <Image
                src="/logo-white.svg"
                alt="DoorStax"
                width={90}
                height={20}
                priority
              />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Vendor
              </span>
            </Link>
            <Link
              href="/api/auth/signout"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-card/95 backdrop-blur-md">
        <div className="grid grid-cols-6">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center gap-0.5 py-2 text-muted-foreground hover:text-primary transition-colors"
            >
              <item.icon className="h-4 w-4" />
              <span className="text-[10px]">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

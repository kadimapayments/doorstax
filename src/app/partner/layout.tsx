import Link from "next/link";
import Image from "next/image";
import { LogOut } from "lucide-react";
import { requireRole } from "@/lib/auth-utils";
import { RolePill } from "@/components/ui/role-pill";

/**
 * Minimal partner (agent) portal layout.
 *
 * Partners don't need the full PM sidebar — just a simple top bar with
 * their name and a link back to their documents / account. Role is
 * enforced both by middleware (/partner/* → role === "PARTNER") and
 * here via requireRole.
 */
export default async function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("PARTNER");

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/partner/documents" className="flex items-center gap-2">
            <Image
              src="/logo-white.svg"
              alt="DoorStax"
              width={110}
              height={24}
              priority
            />
            <RolePill role="PARTNER" />
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden sm:inline text-muted-foreground">
              {user.name || user.email}
            </span>
            <Link
              href="/api/auth/signout"
              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs hover:bg-muted"
            >
              <LogOut className="h-3 w-3" />
              Sign out
            </Link>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

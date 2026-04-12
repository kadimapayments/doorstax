"use client";

import { useState, useEffect, useCallback } from "react";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, User, Sun, Moon, Shield } from "lucide-react";
import type { TeamRole } from "@prisma/client";
import { NotificationDropdown } from "@/components/layout/notification-dropdown";

const ROLE_BADGE_LABELS: Record<TeamRole, string> = {
  MANAGER: "Manager",
  ACCOUNTING: "Accounting",
  CARETAKER: "Caretaker",
  SERVICE_TECH: "Service Tech",
  LEASING_AGENT: "Leasing Agent",
  ASSISTANT_PM: "Assistant PM",
  REGIONAL_MANAGER: "Regional Manager",
  STAFF: "Staff",
};

function getGreeting(name: string): string {
  const hour = new Date().getHours();
  const firstName = name.split(" ")[0];
  const special = [
    `Oh, how we've missed you, ${firstName}!`,
    `Welcome back, ${firstName}!`,
    `Great to see you, ${firstName}!`,
  ];
  if (Math.random() < 0.12) {
    return special[Math.floor(Math.random() * special.length)];
  }
  if (hour < 12) return `Good morning, ${firstName}`;
  if (hour < 17) return `Good afternoon, ${firstName}`;
  return `Good evening, ${firstName}`;
}

interface TopBarProps {
  mobileNav?: React.ReactNode;
  teamRole?: TeamRole | null;
}

export function TopBar({ mobileNav, teamRole }: TopBarProps) {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const user = session?.user;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userRole = (user as any)?.role as string | undefined;
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  const [greeting, setGreeting] = useState("");
  const [noticeCount, setNoticeCount] = useState(0);

  useEffect(() => {
    if (user?.name) setGreeting(getGreeting(user.name));
  }, [user?.name]);

  useEffect(() => {
    fetch("/api/notices")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => { if (Array.isArray(data)) setNoticeCount(data.length); })
      .catch(() => {});
  }, []);

  const handleCountChange = useCallback((count: number) => {
    setNoticeCount(count);
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-2 border-b border-border bg-background/80 px-4 sm:px-6 backdrop-blur-sm">
      {mobileNav}
      <p className="text-sm font-medium text-muted-foreground hidden sm:block truncate max-w-[200px] lg:max-w-none">
        {greeting}
      </p>

      <div className="flex items-center gap-2 ml-auto">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="h-9 w-9"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        <NotificationDropdown
          userRole={userRole}
          noticeCount={noticeCount}
          onCountChange={handleCountChange}
        />

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted outline-none">
            <Avatar size="sm">
              <AvatarFallback className="bg-primary/15 text-primary text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium hidden sm:inline">{user?.name}</span>
            {teamRole && (
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                <Shield className="h-3 w-3" />
                {ROLE_BADGE_LABELS[teamRole]}
              </span>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem disabled>
              <User className="mr-2 h-4 w-4" />
              {user?.email}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

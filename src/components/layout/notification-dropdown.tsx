"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Bell, AlertTriangle, Info, AlertCircle, CheckCheck, Eye, X } from "lucide-react";

interface Notice {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: string;
  readAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
  createdBy?: { name: string; role: string };
}

interface NotificationDropdownProps {
  userRole?: string;
  noticeCount: number;
  onCountChange: (count: number) => void;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function SeverityIcon({ severity }: { severity: string }) {
  switch (severity) {
    case "urgent":
      return <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />;
    default:
      return <Info className="h-4 w-4 shrink-0 text-blue-500" />;
  }
}

export function NotificationDropdown({
  userRole,
  noticeCount,
  onCountChange,
}: NotificationDropdownProps) {
  const router = useRouter();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const notificationPath =
    userRole === "ADMIN"
      ? "/admin/notifications"
      : userRole === "TENANT"
      ? "/tenant/notifications"
      : userRole === "OWNER"
      ? "/owner/notifications"
      : "/dashboard/notifications";

  const fetchNotices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notices");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setNotices(data);
          onCountChange(data.length);
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  async function markAsRead(noticeId: string) {
    await fetch("/api/notices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noticeId }),
    });
    setNotices((prev) =>
      prev.map((n) =>
        n.id === noticeId ? { ...n, readAt: new Date().toISOString() } : n
      )
    );
  }

  async function markAllRead() {
    await fetch("/api/notices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    setNotices((prev) =>
      prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
    );
  }

  async function dismissNotice(noticeId: string) {
    await fetch("/api/notices", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noticeId }),
    });
    setNotices((prev) => prev.filter((n) => n.id !== noticeId));
    onCountChange(Math.max(0, notices.length - 1));
  }

  function handleNoticeClick(notice: Notice) {
    if (!notice.readAt) markAsRead(notice.id);
    setOpen(false);
    router.push(notificationPath);
  }

  const unreadCount = notices.filter((n) => !n.readAt).length;

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (isOpen) fetchNotices();
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 relative">
          <Bell className="h-4 w-4" />
          {noticeCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
              {noticeCount > 9 ? "9+" : noticeCount}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px] p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                markAllRead();
              }}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          )}
        </div>

        {/* Notice List */}
        <div className="max-h-[380px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : notices.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No notifications
            </div>
          ) : (
            notices.map((notice) => (
              <div
                key={notice.id}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 border-b border-border/50 last:border-0 ${
                  !notice.readAt ? "bg-primary/[0.03]" : ""
                }`}
              >
                <button
                  onClick={() => handleNoticeClick(notice)}
                  className="flex items-start gap-3 flex-1 min-w-0 text-left"
                >
                  <SeverityIcon severity={notice.severity} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className={`text-sm truncate ${
                          !notice.readAt
                            ? "font-semibold text-foreground"
                            : "font-medium text-muted-foreground"
                        }`}
                      >
                        {notice.title}
                      </p>
                      {!notice.readAt && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                      {notice.message}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground/70">
                      {notice.createdBy?.name && (
                        <span className="font-medium">
                          {notice.createdBy.name} &middot;{" "}
                        </span>
                      )}
                      {timeAgo(notice.createdAt)}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-1 shrink-0 pt-0.5">
                  {!notice.readAt && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(notice.id);
                      }}
                      title="Mark as read"
                      className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      dismissNotice(notice.id);
                    }}
                    title="Dismiss"
                    className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border">
          <button
            onClick={() => {
              setOpen(false);
              router.push(notificationPath);
            }}
            className="w-full py-2.5 text-center text-xs font-medium text-primary hover:bg-muted/50 transition-colors"
          >
            View all notifications
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, AlertCircle, Info, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Notice {
  id: string;
  type: string;
  title: string;
  message: string;
  amount: string | null;
  severity: string;
  createdAt: string;
  createdBy: { name: string; role: string };
}

const severityConfig: Record<
  string,
  {
    icon: typeof AlertTriangle;
    border: string;
    bg: string;
    text: string;
    iconColor: string;
  }
> = {
  urgent: {
    icon: AlertTriangle,
    border: "border-destructive/30",
    bg: "bg-destructive/5",
    text: "text-destructive",
    iconColor: "text-destructive",
  },
  warning: {
    icon: AlertCircle,
    border: "border-amber-500/30",
    bg: "bg-amber-500/5",
    text: "text-amber-700 dark:text-amber-400",
    iconColor: "text-amber-500",
  },
  info: {
    icon: Info,
    border: "border-primary/30",
    bg: "bg-primary/5",
    text: "text-primary",
    iconColor: "text-primary",
  },
};

export function DashboardNoticeBanner() {
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    fetch("/api/notices")
      .then((res) => {
        if (res.ok) return res.json();
        return [];
      })
      .then((data) => {
        if (Array.isArray(data)) setNotices(data);
      })
      .catch(() => {
        // Silently fail - notices are non-critical
      });
  }, []);

  async function dismiss(noticeId: string) {
    setNotices((prev) => prev.filter((n) => n.id !== noticeId));
    try {
      await fetch("/api/notices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noticeId }),
      });
    } catch {
      // Silently fail - already removed from UI
    }
  }

  if (notices.length === 0) return null;

  return (
    <div className="space-y-3">
      {notices.map((notice) => {
        const config = severityConfig[notice.severity] || severityConfig.info;
        const Icon = config.icon;

        return (
          <div
            key={notice.id}
            className={`flex items-start justify-between gap-3 rounded-lg border p-4 ${config.border} ${config.bg}`}
          >
            <div className="flex items-start gap-3">
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${config.iconColor}`} />
              <div>
                <p className={`font-semibold ${config.text}`}>
                  {notice.title}
                  {notice.amount && (
                    <span className="ml-2">
                      ({formatCurrency(Number(notice.amount))})
                    </span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {notice.message}
                </p>
              </div>
            </div>
            <button
              onClick={() => dismiss(notice.id)}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-background/50 hover:text-foreground transition-colors"
              aria-label="Dismiss notice"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, ExternalLink, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface MerchantInfo {
  status: string;
  url: string | null;
  daysUntilExpiry: number | null;
  createdAt: string;
}

const STATUS_CLASS: Record<string, string> = {
  NOT_STARTED: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
  IN_PROGRESS: "bg-blue-500/15 text-blue-500 border-blue-500/20",
  SUBMITTED: "bg-amber-500/15 text-amber-500 border-amber-500/20",
  APPROVED: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
  EXPIRED: "bg-red-500/15 text-red-500 border-red-500/20",
  REJECTED: "bg-red-500/15 text-red-500 border-red-500/20",
};

export function MerchantApplicationCard() {
  const [info, setInfo] = useState<MerchantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          "/api/merchant-application/send-completion-link"
        );
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          let daysUntilExpiry: number | null = null;
          if (data.status !== "APPROVED" && data.createdAt) {
            const ageDays = Math.floor(
              (Date.now() - new Date(data.createdAt).getTime()) /
                (1000 * 60 * 60 * 24)
            );
            daysUntilExpiry = Math.max(0, 30 - ageDays);
          }
          setInfo({
            status: data.status,
            url: data.url,
            daysUntilExpiry,
            createdAt: data.createdAt || new Date().toISOString(),
          });
        } else {
          setInfo(null);
        }
      } catch {
        setInfo(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSendLink() {
    setSending(true);
    try {
      const res = await fetch(
        "/api/merchant-application/send-completion-link",
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("Application link sent to your email");
      } else {
        toast.error(data.error || "Failed to send link");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSending(false);
    }
  }

  if (loading) return null;
  if (!info) return null;
  if (info.status === "APPROVED") return null;

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          Merchant Application
        </CardTitle>
        <CardDescription>
          Complete your merchant application to start accepting payments from
          your tenants.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className={STATUS_CLASS[info.status] || STATUS_CLASS.NOT_STARTED}
          >
            {info.status.replace("_", " ")}
          </Badge>
          {info.daysUntilExpiry !== null && (
            <span
              className={
                "text-xs font-medium " +
                (info.daysUntilExpiry <= 7
                  ? "text-red-500"
                  : info.daysUntilExpiry <= 14
                    ? "text-amber-500"
                    : "text-muted-foreground")
              }
            >
              {info.daysUntilExpiry === 0
                ? "Expires today"
                : `${info.daysUntilExpiry} day${info.daysUntilExpiry === 1 ? "" : "s"} left to complete`}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {info.url && (
            <a
              href={info.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <ExternalLink className="h-4 w-4" />
              Continue Application
            </a>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={handleSendLink}
            disabled={sending}
          >
            {sending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Mail className="h-4 w-4 mr-2" />
            )}
            Email me the link
          </Button>
        </div>

        {info.status === "EXPIRED" && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-700 dark:text-red-400">
            Your merchant application has expired. Contact support to start a
            new one.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

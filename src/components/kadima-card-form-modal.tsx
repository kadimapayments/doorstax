"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface KadimaCardFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (data: { customerId: string; cardId: string }) => void;
  onError?: (message: string) => void;
}

const POLL_INTERVAL_MS = 4000;
const POLL_MAX_DURATION_MS = 90_000;

export function KadimaCardFormModal({
  open,
  onOpenChange,
  onSuccess,
  onError,
}: KadimaCardFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [formUrl, setFormUrl] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);
  const settledRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const checkCardStatus = useCallback(async (): Promise<boolean> => {
    if (settledRef.current) return true;
    try {
      const res = await fetch("/api/payments/vault-card-status", {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) return false;
      const data = (await res.json()) as {
        hasCard?: boolean;
        customerId?: string | null;
        cardId?: string | null;
      };
      if (data.hasCard && data.customerId && data.cardId) {
        settledRef.current = true;
        stopPolling();
        onSuccess({ customerId: data.customerId, cardId: data.cardId });
        onOpenChange(false);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [onSuccess, onOpenChange, stopPolling]);

  const startPolling = useCallback(() => {
    stopPolling();
    settledRef.current = false;
    pollStartRef.current = Date.now();
    pollRef.current = setInterval(() => {
      if (Date.now() - pollStartRef.current > POLL_MAX_DURATION_MS) {
        stopPolling();
        return;
      }
      void checkCardStatus();
    }, POLL_INTERVAL_MS);
  }, [checkCardStatus, stopPolling]);

  const fetchForm = useCallback(async () => {
    setLoading(true);
    setFormUrl(null);
    try {
      const callbackBase = window.location.origin + "/api/payments/vault-card-callback";
      const returnUrl = callbackBase + "?redirect=/tenant/pay&embedded=true";

      const res = await fetch("/api/payments/vault-card-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnUrl }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load card form");
      }

      const data = await res.json();
      if (data.url) {
        setFormUrl(data.url);
        startPolling();
      } else {
        throw new Error("No form URL returned");
      }
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Failed to load card form");
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }, [onError, onOpenChange, startPolling]);

  // Fetch form when modal opens; tear down polling when it closes.
  useEffect(() => {
    if (open) {
      fetchForm();
    } else {
      setFormUrl(null);
      stopPolling();
      settledRef.current = false;
    }
    return () => {
      stopPolling();
    };
  }, [open, fetchForm, stopPolling]);

  // Listen for postMessage signals from the callback iframe.
  //
  // The current flow sends `kadima-card-form-completed` — a cookie-free
  // wake-up signal. On receipt we trigger an immediate status check rather
  // than waiting for the next poll tick. The legacy `kadima-card-saved` /
  // `kadima-card-error` messages are kept for backwards compatibility during
  // deploy in case a tab cached the old callback response.
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const data = event.data as { type?: string; message?: string } | null;
      if (!data || typeof data.type !== "string") return;

      if (data.type === "kadima-card-form-completed") {
        void checkCardStatus();
        return;
      }
      if (data.type === "kadima-card-saved") {
        // Legacy path — trust the postMessage but still confirm server-side
        // so the card actually lands in the tenant profile.
        void checkCardStatus();
        return;
      }
      if (data.type === "kadima-card-error") {
        stopPolling();
        onError?.(data.message || "Card save failed");
        onOpenChange(false);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [checkCardStatus, onError, onOpenChange, stopPolling]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden" style={{ height: "600px" }}>
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Add Payment Card</DialogTitle>
        </DialogHeader>
        <div className="flex-1 relative" style={{ height: "530px" }}>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading secure card form...</span>
            </div>
          )}
          {formUrl && (
            <iframe
              ref={iframeRef}
              src={formUrl}
              className="w-full h-full border-0"
              allow="payment"
              sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-top-navigation"
              title="Secure Card Form"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

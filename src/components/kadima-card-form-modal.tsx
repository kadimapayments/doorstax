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

export function KadimaCardFormModal({
  open,
  onOpenChange,
  onSuccess,
  onError,
}: KadimaCardFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [formUrl, setFormUrl] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchForm = useCallback(async () => {
    setLoading(true);
    setFormUrl(null);
    try {
      // Use a special returnUrl that the iframe will navigate to on completion
      // We'll detect this navigation by polling the iframe's URL
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
      } else {
        throw new Error("No form URL returned");
      }
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Failed to load card form");
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }, [onError, onOpenChange]);

  // Fetch form when modal opens
  useEffect(() => {
    if (open) {
      fetchForm();
    } else {
      setFormUrl(null);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [open, fetchForm]);

  // Listen for postMessage from the callback page
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "kadima-card-saved") {
        const { customerId, cardId } = event.data;
        onSuccess({ customerId, cardId });
        onOpenChange(false);
      }
      if (event.data?.type === "kadima-card-error") {
        onError?.(event.data.message || "Card save failed");
        onOpenChange(false);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onSuccess, onError, onOpenChange]);

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

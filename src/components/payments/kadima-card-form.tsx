"use client";

import { useEffect, useRef, useState, useId } from "react";
import Script from "next/script";
import { Shield } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Kadima HostedFields.js SDK integration                             */
/*  Docs: https://developers.kadimadashboard.com/#/payment-gateway     */
/* ------------------------------------------------------------------ */

const HOSTED_FIELDS_JS =
  "https://sandbox.kadimadashboard.com/js/HostedFields.js";

export interface CardFormResult {
  customerId?: string;
  cardId?: string;
  cardBrand?: string;
  lastFour?: string;
  id?: string; // transaction id (if payment was processed)
}

interface KadimaCardFormProps {
  token: string;
  amount?: number;
  onSuccess: (data: CardFormResult) => void;
  onError: (message: string) => void;
}

// Global type for the SDK
declare global {
  interface Window {
    HostedFields?: {
      create: (config: Record<string, unknown>) => EventTarget;
    };
  }
}

/**
 * The Kadima SDK defines `class HostedFields` at the top level.
 * Class declarations do NOT auto-assign to `window` in JS (unlike var/function).
 * This helper accesses it from the global scope and caches it on window.
 */
function getHostedFieldsClass(): typeof window.HostedFields | undefined {
  if (window.HostedFields) return window.HostedFields;
  try {
    const HF = new Function("return typeof HostedFields !== 'undefined' ? HostedFields : undefined")();
    if (HF) {
      window.HostedFields = HF;
      return HF;
    }
  } catch {
    // Not available
  }
  return undefined;
}

export function KadimaCardForm({
  token,
  amount,
  onSuccess,
  onError,
}: KadimaCardFormProps) {
  const uid = useId().replace(/:/g, ""); // unique prefix for DOM ids
  const formRef = useRef<EventTarget | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [ready, setReady] = useState(false);

  // Keep callbacks in refs so we can use them in event handlers
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;

  // Check if already loaded on mount
  useEffect(() => {
    if (getHostedFieldsClass()) {
      setScriptLoaded(true);
    }
  }, []);

  // Initialize hosted fields when script + token are ready
  useEffect(() => {
    if (!scriptLoaded || !token) return;
    if (formRef.current) return;

    const HF = getHostedFieldsClass();
    if (!HF) {
      console.error("[kadima-card-form] HostedFields class not found");
      return;
    }

    // Small delay ensures DOM containers are painted
    const timer = setTimeout(() => {
      try {
        const amountCents = Math.round((amount || 0) * 100);
        console.log("[kadima-card-form] Creating hosted fields, amount:", amountCents);
        const form = HF.create({
          token,
          amount: amountCents,
          fields: {
            cardNumber: { target: `#kf-${uid}-number`, useTargetStyle: true },
            cardExpiration: { target: `#kf-${uid}-exp`, useTargetStyle: true },
            cardCvv: { target: `#kf-${uid}-cvv`, useTargetStyle: true },
            cardHolderName: { target: `#kf-${uid}-holder`, useTargetStyle: true },
            submit: { target: `#kf-${uid}-submit` },
          },
        });

        formRef.current = form;

        form.addEventListener("hostedFields.ready", () => {
          console.log("[kadima-card-form] Hosted fields ready");
          setReady(true);
        });

        form.addEventListener(
          "submit.result",
          ((e: CustomEvent) => {
            const detail = e.detail || {};
            console.log("[kadima-card-form] Submit result:", detail);
            onSuccessRef.current({
              customerId: detail.customerId,
              cardId: detail.cardId,
              cardBrand: detail.cardType || detail.cardBrand,
              lastFour: detail.lastFour,
              id: detail.id,
            });
          }) as EventListener
        );

        form.addEventListener(
          "hostedFields.error",
          ((e: CustomEvent) => {
            const detail = e.detail || {};
            console.error("[kadima-card-form] Error:", detail);
            onErrorRef.current(detail.message || "Card entry failed");
          }) as EventListener
        );
      } catch (err) {
        console.error("[kadima-card-form] Init error:", err);
        onErrorRef.current("Failed to load payment form");
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [scriptLoaded, token, amount, uid]);

  // Reset form ref when token changes
  useEffect(() => {
    return () => {
      formRef.current = null;
      setReady(false);
    };
  }, [token]);

  return (
    <div className="space-y-4">
      <Script
        src={HOSTED_FIELDS_JS}
        strategy="afterInteractive"
        onLoad={() => {
          const HF = getHostedFieldsClass();
          console.log("[kadima-card-form] SDK script loaded, class found:", !!HF);
          setScriptLoaded(true);
        }}
        onError={() => onError("Failed to load payment SDK")}
      />

      {/* Ensure iframes rendered by SDK fill their containers */}
      <style>{`
        [id^="kf-${uid}"] iframe {
          width: 100% !important;
          height: 100% !important;
          min-height: 40px;
          border: none !important;
        }
        /* Submit button — NO height constraints so the SDK iframe button is clickable.
           The SDK renders a ~150px tall iframe; we let it render fully. */
        #kf-${uid}-submit {
          border-radius: 0.375rem;
        }
        #kf-${uid}-submit iframe {
          border-radius: 0.375rem;
        }
      `}</style>

      {/* Card form containers — the SDK renders secure iframes inside these */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            Card Number
          </label>
          <div
            id={`kf-${uid}-number`}
            className="h-10 rounded-md border border-input bg-background overflow-hidden"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Expiration
            </label>
            <div
              id={`kf-${uid}-exp`}
              className="h-10 rounded-md border border-input bg-background overflow-hidden"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">CVV</label>
            <div
              id={`kf-${uid}-cvv`}
              className="h-10 rounded-md border border-input bg-background overflow-hidden"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            Cardholder Name
          </label>
          <div
            id={`kf-${uid}-holder`}
            className="h-10 rounded-md border border-input bg-background overflow-hidden"
          />
        </div>

        {/* SDK submit button — rendered at native size for click reliability */}
        <div id={`kf-${uid}-submit`} className="pt-1" />
      </div>

      {!ready && scriptLoaded && token && (
        <p className="text-xs text-muted-foreground text-center animate-pulse">
          Initializing secure fields…
        </p>
      )}

      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Card details are securely processed by our payment partner. DoorStax
          never stores your full card number.
        </p>
      </div>
    </div>
  );
}

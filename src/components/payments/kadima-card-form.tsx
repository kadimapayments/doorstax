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
  /** Tokenized card fields from /hosted-fields/card-token (save-card flows) */
  cardToken?: string;
  bin?: string;
  exp?: string;
  maskedNumber?: string;
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

/**
 * After a save-card submission (amount=0), retrieve the tokenized card
 * by calling our server-side proxy to Kadima's /hosted-fields/card-token.
 */
async function fetchCardToken(
  accessToken: string
): Promise<{ token: string; bin: string; exp: string; number: string }> {
  const res = await fetch("/api/payments/hosted-card-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    console.error("[fetchCardToken] Server error:", res.status, errBody);
    throw new Error(errBody?.detail || errBody?.error || "Failed to retrieve card token");
  }
  return res.json();
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
  const [submitting, setSubmitting] = useState(false);

  // Keep callbacks in refs so we can use them in event handlers
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const tokenRef = useRef(token);
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;
  tokenRef.current = token;

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
        // Kadima SDK expects amount in DOLLARS (not cents).
        // amount=0 means save-card-only (no payment).
        const amountDollars = Math.round((amount || 0) * 100) / 100;
        const isSaveCardOnly = amountDollars === 0;
        console.log("[kadima-card-form] Creating hosted fields, amount:", amountDollars, "saveCardOnly:", isSaveCardOnly);

        const form = HF.create({
          token,
          amount: amountDollars,
          fields: {
            cardNumber: { target: `#kf-${uid}-number`, useTargetStyle: true },
            cardExpiration: { target: `#kf-${uid}-exp`, useTargetStyle: true },
            cardCvv: { target: `#kf-${uid}-cvv`, useTargetStyle: true },
            cardHolderName: { target: `#kf-${uid}-holder`, useTargetStyle: true },
            submit: { target: `#kf-${uid}-submit` },
          },
          // NOTE: Do NOT pass `styles` here — it breaks the submit button click
          // handler inside the Kadima iframe. The SDK applies its own default
          // styling. See plan: iridescent-dreaming-bird.md for analysis.
        });

        formRef.current = form;

        form.addEventListener("hostedFields.ready", () => {
          console.log("[kadima-card-form] Hosted fields ready");
          setReady(true);
        });

        form.addEventListener(
          "submit.result",
          (async (e: CustomEvent) => {
            const detail = e.detail || {};
            console.log("[kadima-card-form] Submit result (all keys):", JSON.stringify(detail));
            console.log("[kadima-card-form] Submit result detail:", {
              result: detail.result,
              id: detail.id,
              customerId: detail.customerId,
              cardId: detail.cardId,
              cardType: detail.cardType,
              cardBrand: detail.cardBrand,
              lastFour: detail.lastFour,
              token: detail.token,
              saveCard: detail.saveCard,
            });

            // For save-card-only flows (amount=0), detail.id will be null
            // but detail.result should be true. We need to fetch the card token.
            if (isSaveCardOnly) {
              try {
                setSubmitting(true);
                const cardData = await fetchCardToken(tokenRef.current);
                console.log("[kadima-card-form] Card token retrieved:", {
                  bin: cardData.bin,
                  exp: cardData.exp,
                  number: cardData.number,
                });
                // Extract last 4 from masked number (e.g., "411111******1111" → "1111")
                const lastFour = cardData.number?.slice(-4);
                onSuccessRef.current({
                  cardToken: cardData.token,
                  bin: cardData.bin,
                  exp: cardData.exp,
                  maskedNumber: cardData.number,
                  lastFour,
                  // Also include any fields the SDK returned
                  customerId: detail.customerId,
                  cardId: detail.cardId,
                  cardBrand: detail.cardType || detail.cardBrand,
                  id: detail.id,
                });
              } catch (err) {
                console.error("[kadima-card-form] Card token retrieval error:", err);
                onErrorRef.current("Card saved but failed to retrieve token. Please try again.");
              } finally {
                setSubmitting(false);
              }
              return;
            }

            // For payment flows (amount > 0), use the standard result
            onSuccessRef.current({
              customerId: detail.customerId,
              cardId: detail.cardId,
              cardBrand: detail.cardType || detail.cardBrand,
              lastFour: detail.lastFour,
              id: detail.id,
            });
          }) as unknown as EventListener
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
          min-height: 40px;
          border: none !important;
        }
        /* Card field iframes: fill their h-10 containers */
        #kf-${uid}-number iframe,
        #kf-${uid}-exp iframe,
        #kf-${uid}-cvv iframe,
        #kf-${uid}-holder iframe {
          height: 100% !important;
        }
        /* Submit: clip to button height, hide 3DS whitespace below.
           The SDK renders the iframe at 150px to reserve space for 3DS,
           but we only need the button (~45px). The button click works fine
           with this clip since the button is at the top of the iframe. */
        #kf-${uid}-submit {
          max-height: 50px;
          overflow: hidden;
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

      {submitting && (
        <p className="text-xs text-muted-foreground text-center animate-pulse">
          Saving card…
        </p>
      )}

      {!ready && scriptLoaded && token && !submitting && (
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

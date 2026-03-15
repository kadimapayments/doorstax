"use client";

import { useState, useCallback } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import Script from "next/script";
import { PhoneInput } from "@/components/ui/phone-input";

const RECAPTCHA_SITE_KEY = "6LfGEUsUAAAAAL7XJUuvi1dYWeWAH18BLwKfoBmn";

declare global {
  interface Window {
    grecaptcha: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

export function MaverickLeadForm() {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [recaptchaLoaded, setRecaptchaLoaded] = useState(false);

  const onRecaptchaLoad = useCallback(() => {
    if (window.grecaptcha) {
      window.grecaptcha.ready(() => setRecaptchaLoaded(true));
    }
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    const form = e.currentTarget;
    const data: Record<string, string> = {
      name: (form.elements.namedItem("name") as HTMLInputElement).value.trim(),
      email: (form.elements.namedItem("email") as HTMLInputElement).value.trim(),
      phone: (form.elements.namedItem("phone") as HTMLInputElement).value.trim(),
      company: (form.elements.namedItem("company") as HTMLInputElement).value.trim(),
      productAndService: `Buildings: ${(form.elements.namedItem("buildings") as HTMLInputElement).value.trim()}, Units: ${(form.elements.namedItem("units") as HTMLInputElement).value.trim()}`,
    };

    // Get reCAPTCHA token
    try {
      if (recaptchaLoaded && window.grecaptcha) {
        data.captchaToken = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, {
          action: "lead_submit",
        });
      }
    } catch (err) {
      console.warn("reCAPTCHA failed:", err);
    }

    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setStatus("success");
      } else {
        const body = await res.json().catch(() => ({}));
        setErrorMsg(body.error || "Something went wrong. Please try again.");
        setStatus("error");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center gap-3 py-6 animate-fade-in-up">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20">
          <CheckCircle2 className="h-7 w-7 text-emerald-400" />
        </div>
        <h3 className="text-lg font-bold text-text-primary">
          You&apos;re on the list!
        </h3>
        <p className="text-sm text-text-secondary text-center">
          We&apos;ll be in touch when DoorStax launches. Stay tuned.
        </p>
      </div>
    );
  }

  return (
    <>
      <Script
        src={`https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`}
        strategy="afterInteractive"
        onLoad={onRecaptchaLoad}
      />
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label htmlFor="lead-name" className="block text-xs font-medium text-text-secondary mb-1.5">
            Full Name
          </label>
          <input
            id="lead-name"
            name="name"
            type="text"
            required
            placeholder="John Smith"
            className="w-full rounded-lg border border-border bg-bg-secondary px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-lavender focus:outline-none focus:ring-1 focus:ring-accent-lavender/50 transition-colors"
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="lead-email" className="block text-xs font-medium text-text-secondary mb-1.5">
            Email
          </label>
          <input
            id="lead-email"
            name="email"
            type="email"
            required
            placeholder="john@example.com"
            className="w-full rounded-lg border border-border bg-bg-secondary px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-lavender focus:outline-none focus:ring-1 focus:ring-accent-lavender/50 transition-colors"
          />
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="lead-phone" className="block text-xs font-medium text-text-secondary mb-1.5">
            Phone
          </label>
          <PhoneInput
            id="lead-phone"
            name="phone"
            required
            placeholder="(555) 123-4567"
            className="w-full rounded-lg border border-border bg-bg-secondary px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-lavender focus:outline-none focus:ring-1 focus:ring-accent-lavender/50 transition-colors"
          />
        </div>

        {/* Company */}
        <div>
          <label htmlFor="lead-company" className="block text-xs font-medium text-text-secondary mb-1.5">
            Company Name
          </label>
          <input
            id="lead-company"
            name="company"
            type="text"
            required
            placeholder="Acme Property Management"
            className="w-full rounded-lg border border-border bg-bg-secondary px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-lavender focus:outline-none focus:ring-1 focus:ring-accent-lavender/50 transition-colors"
          />
        </div>

        {/* Buildings + Units row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="lead-buildings" className="block text-xs font-medium text-text-secondary mb-1.5">
              # of Buildings
            </label>
            <input
              id="lead-buildings"
              name="buildings"
              type="number"
              min="1"
              required
              placeholder="5"
              className="w-full rounded-lg border border-border bg-bg-secondary px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-lavender focus:outline-none focus:ring-1 focus:ring-accent-lavender/50 transition-colors"
            />
          </div>
          <div>
            <label htmlFor="lead-units" className="block text-xs font-medium text-text-secondary mb-1.5">
              # of Units
            </label>
            <input
              id="lead-units"
              name="units"
              type="number"
              min="1"
              required
              placeholder="50"
              className="w-full rounded-lg border border-border bg-bg-secondary px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-lavender focus:outline-none focus:ring-1 focus:ring-accent-lavender/50 transition-colors"
            />
          </div>
        </div>

        {/* Error message */}
        {status === "error" && (
          <p className="text-sm text-red-400 text-center">{errorMsg}</p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={status === "submitting"}
          className="w-full rounded-lg bg-accent-purple px-6 py-3 text-sm font-semibold text-white hover:bg-accent-purple/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {status === "submitting" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            "Get Early Access"
          )}
        </button>
      </form>
    </>
  );
}

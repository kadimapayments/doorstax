"use client";

import { useState } from "react";
import { ApplicationForm } from "./application-form";
import { Mail, ShieldCheck, AlertCircle } from "lucide-react";

interface ApplyGateProps {
  unitId: string;
  verifiedEmail: string | null;
  tokenError: string | null;
  token: string | null;
  unitInfo: {
    unitNumber: string;
    rent: number;
    bedrooms: number | null;
    bathrooms: number | null;
  };
  propertyInfo: {
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
  };
}

export function ApplyGate({
  unitId,
  verifiedEmail,
  tokenError,
  token,
  unitInfo,
  propertyInfo,
}: ApplyGateProps) {
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleRequestLink() {
    if (honeypot) return; // Bot detected
    if (!email.includes("@")) return;

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/apply/${unitId}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setSent(true);
      } else {
        setError(data.error || "Something went wrong");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Token error — show message with option to request new link
  if (tokenError) {
    return (
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
          <div>
            <p className="text-sm font-medium">{tokenError}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Enter your email below to receive a new application link.
            </p>
          </div>
        </div>
        <EmailRequestForm
          email={email}
          setEmail={setEmail}
          honeypot={honeypot}
          setHoneypot={setHoneypot}
          submitting={submitting}
          sent={sent}
          error={error}
          onSubmit={handleRequestLink}
        />
      </div>
    );
  }

  // Verified token — show full application form
  if (verifiedEmail && token) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-green-600 shrink-0" />
          <p className="text-sm text-green-700 dark:text-green-400">
            Email verified:{" "}
            <span className="font-medium">{verifiedEmail}</span>
          </p>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <ApplicationForm
            unitId={unitId}
            unitInfo={unitInfo}
            propertyInfo={propertyInfo}
            verifiedEmail={verifiedEmail}
            token={token}
          />
        </div>
      </div>
    );
  }

  // No token — show email request form
  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      <div className="text-center space-y-2">
        <Mail className="h-10 w-10 text-primary mx-auto" />
        <h2 className="text-lg font-semibold">Apply for this unit</h2>
        <p className="text-sm text-muted-foreground">
          Enter your email address to receive a secure application link.
        </p>
      </div>
      <EmailRequestForm
        email={email}
        setEmail={setEmail}
        honeypot={honeypot}
        setHoneypot={setHoneypot}
        submitting={submitting}
        sent={sent}
        error={error}
        onSubmit={handleRequestLink}
      />
    </div>
  );
}

function EmailRequestForm({
  email,
  setEmail,
  honeypot,
  setHoneypot,
  submitting,
  sent,
  error,
  onSubmit,
}: {
  email: string;
  setEmail: (v: string) => void;
  honeypot: string;
  setHoneypot: (v: string) => void;
  submitting: boolean;
  sent: boolean;
  error: string;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-3">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        className="w-full rounded-lg border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        required
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSubmit();
          }
        }}
      />

      {/* Honeypot */}
      <input
        type="text"
        name="website"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        style={{
          position: "absolute",
          left: "-9999px",
          opacity: 0,
          height: 0,
        }}
        tabIndex={-1}
        autoComplete="off"
      />

      <button
        onClick={onSubmit}
        disabled={submitting || !email.includes("@")}
        className="w-full rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {submitting ? "Sending..." : "Send Application Link"}
      </button>

      {sent && (
        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4">
          <p className="text-sm text-green-700 dark:text-green-400 font-medium">
            Application link sent!
          </p>
          <p className="text-xs text-green-600 dark:text-green-500 mt-1">
            Check your email (including spam folder) for a link to complete your
            application. The link expires in 24 hours.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}

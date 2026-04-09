"use client";

import { useState, useEffect } from "react";
import { ScreeningConfigPanel } from "./screening-config-panel";
import {
  Link2,
  Send,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

interface Invitation {
  id: string;
  email: string;
  sentAt: string;
  status: string;
}

interface UnitScreeningSectionProps {
  unitId: string;
  propertyId: string;
  applyLink: string | null;
  applyLinkFull: string | null;
  applyLinkGeneratedAt: string | null;
  screeningOverrides: {
    creditReport: boolean | null;
    criminal: boolean | null;
    eviction: boolean | null;
    application: boolean | null;
    payerType: string | null;
  };
  pmDefaults: {
    creditReport: boolean;
    criminal: boolean;
    eviction: boolean;
    application: boolean;
    payerType: string;
  };
  propertyState?: string;
}

export function UnitScreeningSection({
  unitId,
  propertyId,
  applyLink: initialLink,
  applyLinkFull: initialFullLink,
  applyLinkGeneratedAt,
  screeningOverrides,
  pmDefaults,
  propertyState,
}: UnitScreeningSectionProps) {
  const [applyLink, setApplyLink] = useState(initialLink);
  const [applyLinkFull, setApplyLinkFull] = useState(initialFullLink);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showOverrides, setShowOverrides] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [sendingEmails, setSendingEmails] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  // Resolved config (override or default)
  const [config, setConfig] = useState({
    creditReport:
      screeningOverrides.creditReport ?? pmDefaults.creditReport,
    criminal: screeningOverrides.criminal ?? pmDefaults.criminal,
    eviction: screeningOverrides.eviction ?? pmDefaults.eviction,
    application:
      screeningOverrides.application ?? pmDefaults.application,
    payerType: screeningOverrides.payerType ?? pmDefaults.payerType,
  });

  // Fetch sent invitations
  useEffect(() => {
    fetch(`/api/rentspree/invitations/${unitId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setInvitations(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [unitId]);

  async function handleGenerateLink() {
    setGenerating(true);
    try {
      const res = await fetch("/api/rentspree/generate-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId }),
      });
      const data = await res.json();
      if (res.ok) {
        setApplyLink(data.applyLink);
        setApplyLinkFull(data.fullLink);
        toast.success(
          data.mock
            ? "Mock apply link generated (RentSpree not configured)"
            : "Apply link generated!"
        );
      } else {
        toast.error(data.error || "Failed to generate link");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopyLink() {
    if (!applyLink) return;
    await navigator.clipboard.writeText(applyLink);
    setCopied(true);
    toast.success("Apply link copied!");
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSendInvitations() {
    const emails = emailInput
      .split(/[,;\n]+/)
      .map((e) => e.trim())
      .filter((e) => e.includes("@"));

    if (emails.length === 0) {
      toast.error("Enter at least one valid email");
      return;
    }

    setSendingEmails(true);
    try {
      const res = await fetch("/api/rentspree/send-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId, emails }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(
          `Screening invitation sent to ${data.sent} applicant${data.sent > 1 ? "s" : ""}`
        );
        setEmailInput("");
        setShowEmailForm(false);
        if (data.applyLink) setApplyLink(data.applyLink);
        // Refresh invitations
        fetch(`/api/rentspree/invitations/${unitId}`)
          .then((r) => (r.ok ? r.json() : []))
          .then((d) => setInvitations(Array.isArray(d) ? d : []))
          .catch(() => {});
      } else {
        toast.error(data.error || "Failed to send");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSendingEmails(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Tenant Screening
        </h3>
        <span className="text-xs text-muted-foreground">
          Powered by RentSpree
        </span>
      </div>

      {/* Apply Link Display */}
      {applyLink ? (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Apply Link</p>
              <p className="text-sm font-mono truncate">{applyLink}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleCopyLink}
                className="rounded-lg border p-2 hover:bg-muted"
                title="Copy link"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
              {applyLinkFull && (
                <a
                  href={applyLinkFull}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border p-2 hover:bg-muted"
                  title="Open apply page"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              <button
                onClick={handleGenerateLink}
                disabled={generating}
                className="rounded-lg border p-2 hover:bg-muted disabled:opacity-50"
                title="Regenerate link"
              >
                <RefreshCw
                  className={
                    "h-3.5 w-3.5" + (generating ? " animate-spin" : "")
                  }
                />
              </button>
            </div>
          </div>
          {applyLinkGeneratedAt && (
            <p className="text-xs text-muted-foreground">
              Generated{" "}
              {new Date(applyLinkGeneratedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      ) : (
        <button
          onClick={handleGenerateLink}
          disabled={generating}
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Link2 className="h-4 w-4" />
          {generating ? "Generating..." : "Generate Apply Link"}
        </button>
      )}

      {/* Send Screening Invitation */}
      <button
        onClick={() => setShowEmailForm(!showEmailForm)}
        className="w-full rounded-lg border py-2 text-sm font-medium hover:bg-muted flex items-center justify-center gap-1.5"
      >
        <Send className="h-3.5 w-3.5" />
        Send Screening Invitation
      </button>

      {showEmailForm && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <p className="text-sm font-medium">
            Send branded invitation to applicants
          </p>
          <p className="text-xs text-muted-foreground">
            Applicants will receive a DoorStax-branded email with your apply
            link.
          </p>
          <textarea
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="Enter email addresses (comma or newline separated)"
            rows={3}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSendInvitations}
              disabled={sendingEmails || !emailInput.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {sendingEmails ? "Sending..." : "Send Invitations"}
            </button>
            <button
              onClick={() => {
                setShowEmailForm(false);
                setEmailInput("");
              }}
              className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Sent Invitations */}
      {invitations.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Sent Invitations
          </p>
          <div className="space-y-1.5">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between text-sm py-1.5 border-b last:border-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="truncate">{inv.email}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={
                      "text-xs px-1.5 py-0.5 rounded " +
                      (inv.status === "COMPLETED"
                        ? "bg-emerald-500/10 text-emerald-500"
                        : "bg-muted text-muted-foreground")
                    }
                  >
                    {inv.status === "COMPLETED" ? "Applied" : "Sent"}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(inv.sentAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Screening config override toggle */}
      <button
        onClick={() => setShowOverrides(!showOverrides)}
        className="text-xs text-muted-foreground hover:text-foreground underline"
      >
        {showOverrides
          ? "Hide screening options"
          : "Customize screening options for this unit"}
      </button>

      {showOverrides && (
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground mb-3">
            Override your default screening settings for this unit only.
          </p>
          <ScreeningConfigPanel
            creditReport={config.creditReport}
            criminal={config.criminal}
            eviction={config.eviction}
            application={config.application}
            payerType={config.payerType}
            propertyState={propertyState}
            onChange={async (newConfig) => {
              setConfig(newConfig);
              try {
                await fetch(
                  `/api/properties/${propertyId}/units/${unitId}`,
                  {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      screeningCreditReport: newConfig.creditReport,
                      screeningCriminal: newConfig.criminal,
                      screeningEviction: newConfig.eviction,
                      screeningApplication: newConfig.application,
                      screeningPayerType: newConfig.payerType,
                    }),
                  }
                );
                toast.success("Screening options updated");
              } catch {
                toast.error("Failed to save");
              }
            }}
          />
        </div>
      )}
    </div>
  );
}

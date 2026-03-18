"use client";

import { useRef, useState, useCallback } from "react";
import SignatureCanvas from "react-signature-canvas";
import { CheckCircle2, FileText, Loader2, AlertCircle, Download, Trash2 } from "lucide-react";

interface Principal {
  id: string;
  firstName: string;
  lastName: string;
  title: string | null;
  ownershipPercent: number | null;
  alreadySigned: boolean;
}

interface Props {
  applicationId: string;
  businessName: string;
  dba: string;
  principals: Principal[];
  alreadySigned: boolean;
  agreementPdfUrl: string | null;
}

export function SignAgreementClient({
  applicationId,
  businessName,
  dba,
  principals,
  alreadySigned: initialAlreadySigned,
  agreementPdfUrl,
}: Props) {
  const [alreadySigned, setAlreadySigned] = useState(initialAlreadySigned);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [resultUrls, setResultUrls] = useState<{
    agreementPdfUrl: string;
    signatureDetailsPdfUrl: string;
  } | null>(null);

  // Create refs for each principal's signature canvas
  const sigRefs = useRef<Record<string, SignatureCanvas | null>>({});
  const [signedFlags, setSignedFlags] = useState<Record<string, boolean>>({});

  const setRef = useCallback(
    (principalId: string) => (ref: SignatureCanvas | null) => {
      sigRefs.current[principalId] = ref;
    },
    []
  );

  const clearSignature = (principalId: string) => {
    sigRefs.current[principalId]?.clear();
    setSignedFlags((prev) => ({ ...prev, [principalId]: false }));
  };

  const markSigned = (principalId: string) => {
    const canvas = sigRefs.current[principalId];
    if (canvas && !canvas.isEmpty()) {
      setSignedFlags((prev) => ({ ...prev, [principalId]: true }));
    }
  };

  const handleSubmit = async () => {
    setError(null);

    // Validate all principals have signatures
    const signatures: Array<{ principalId: string; signatureBase64: string }> = [];
    for (const p of principals) {
      if (p.alreadySigned) continue;
      const canvas = sigRefs.current[p.id];
      if (!canvas || canvas.isEmpty()) {
        setError(`Please provide a signature for ${p.firstName} ${p.lastName}`);
        return;
      }
      signatures.push({
        principalId: p.id,
        signatureBase64: canvas.toDataURL("image/png"),
      });
    }

    if (signatures.length === 0) {
      setError("No signatures to submit");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/boarding/agreement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signatures,
          userAgent: navigator.userAgent,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to submit signatures");
      }

      const data = await res.json();
      setResultUrls({
        agreementPdfUrl: data.agreementPdfUrl,
        signatureDetailsPdfUrl: data.signatureDetailsPdfUrl,
      });
      setSuccess(true);
      setAlreadySigned(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Already Signed View ──
  if (alreadySigned && !success) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
          <h2 className="mt-4 text-xl font-bold text-green-900">Agreement Already Signed</h2>
          <p className="mt-2 text-sm text-green-700">
            The Merchant Account Application and Agreement V1.8 for{" "}
            <strong>{businessName}</strong> has already been signed and submitted.
          </p>
          {agreementPdfUrl && (
            <a
              href={agreementPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              <Download className="h-4 w-4" />
              Download Signed Agreement
            </a>
          )}
        </div>
      </div>
    );
  }

  // ── Success View ──
  if (success && resultUrls) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
          <h2 className="mt-4 text-xl font-bold text-green-900">Agreement Signed Successfully</h2>
          <p className="mt-2 text-sm text-green-700">
            Your Merchant Account Application and Agreement V1.8 has been signed and submitted.
            A confirmation email with the signed documents has been sent.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a
              href={resultUrls.agreementPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#5B00FF] px-4 py-2 text-sm font-medium text-white hover:bg-[#4A00CC]"
            >
              <Download className="h-4 w-4" />
              Signed Agreement PDF
            </a>
            <a
              href={resultUrls.signatureDetailsPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <FileText className="h-4 w-4" />
              Signature Audit Trail
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── Signing View ──
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sign Merchant Agreement</h1>
        <p className="mt-1 text-sm text-gray-500">
          Merchant Account Application and Agreement V1.8
        </p>
      </div>

      {/* Agreement Summary Card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 h-5 w-5 text-[#5B00FF]" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Agreement Summary</h2>
            <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-medium text-gray-500">Legal Business Name</dt>
                <dd className="text-gray-900">{businessName}</dd>
              </div>
              {dba && (
                <div>
                  <dt className="font-medium text-gray-500">DBA</dt>
                  <dd className="text-gray-900">{dba}</dd>
                </div>
              )}
              <div>
                <dt className="font-medium text-gray-500">Application ID</dt>
                <dd className="font-mono text-xs text-gray-600">{applicationId}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500">Principals</dt>
                <dd className="text-gray-900">{principals.length}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Preview link */}
        <div className="mt-4 border-t border-gray-100 pt-4">
          <a
            href="/api/boarding/agreement"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#5B00FF] hover:underline"
          >
            <FileText className="h-4 w-4" />
            Preview full agreement PDF (unsigned)
          </a>
        </div>
      </div>

      {/* Terms Summary */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <h3 className="text-sm font-semibold text-amber-900">Key Terms</h3>
        <ul className="mt-2 space-y-1 text-xs text-amber-800">
          <li>- Initial term of 3 years; auto-renews for 1-year terms</li>
          <li>- Merchant is responsible for all chargebacks and associated fees</li>
          <li>- PCI DSS compliance is required at all times</li>
          <li>- Bank may establish a reserve account at its discretion</li>
          <li>- Fees as specified in Schedule A (Fee Schedule)</li>
          <li>- Electronic signatures have the same legal effect as ink signatures (E-SIGN Act)</li>
        </ul>
      </div>

      {/* Signature Pads */}
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-gray-900">Signatures</h2>
        <p className="text-sm text-gray-500">
          Each principal must sign below to accept the terms of the agreement.
        </p>

        {principals.map((p) => (
          <div
            key={p.id}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">
                  {p.firstName} {p.lastName}
                </h3>
                <p className="text-xs text-gray-500">
                  {p.title || "Principal"}
                  {p.ownershipPercent != null && ` | ${p.ownershipPercent}% ownership`}
                </p>
              </div>
              {(p.alreadySigned || signedFlags[p.id]) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                  <CheckCircle2 className="h-3 w-3" />
                  Signed
                </span>
              )}
            </div>

            {p.alreadySigned ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center text-sm text-green-700">
                This principal has already signed the agreement.
              </div>
            ) : (
              <>
                <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50">
                  <SignatureCanvas
                    ref={setRef(p.id)}
                    penColor="#1a1a1a"
                    canvasProps={{
                      className: "w-full h-32 rounded-lg",
                      style: { width: "100%", height: "128px" },
                    }}
                    onEnd={() => markSigned(p.id)}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-gray-400">
                    Sign using your mouse or touchscreen above
                  </p>
                  <button
                    type="button"
                    onClick={() => clearSignature(p.id)}
                    className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  >
                    <Trash2 className="h-3 w-3" />
                    Clear
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Consent & Submit */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-xs text-gray-500 leading-relaxed">
          By clicking &quot;Sign &amp; Submit Agreement&quot; below, you confirm that you have read,
          understand, and agree to the terms of the Merchant Account Application and Agreement V1.8,
          including all Terms and Conditions (Sections 1-48) and Schedule A. You consent to using
          electronic signatures pursuant to the E-SIGN Act (15 U.S.C. 7001 et seq.) and acknowledge
          that your electronic signature has the same legal effect as a handwritten signature.
        </p>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#5B00FF] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#4A00CC] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing Agreement...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Sign &amp; Submit Agreement
            </>
          )}
        </button>
      </div>
    </div>
  );
}

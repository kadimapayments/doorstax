"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, Upload, Check, X, FileText } from "lucide-react";
import { SECTION_LABELS } from "@/lib/application-fields";
import { SignaturePad } from "./signature-pad";

interface Field {
  id: string;
  label: string;
  type: string;
  options: string[];
  required: boolean;
  section: string;
  placeholder: string | null;
  helpText: string | null;
}

interface DocRequirement {
  id: string;
  label: string;
  description: string | null;
  required: boolean;
  acceptedTypes: string[];
  maxFileSizeMb: number;
}

interface UploadedDoc {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSizeMb: number;
}

interface ApplicationFormProps {
  unitId: string;
  unitInfo: { unitNumber: string; rent: number; bedrooms: number | null; bathrooms: number | null };
  propertyInfo: { name: string; address: string; city: string; state: string; zip: string };
  verifiedEmail?: string;
  token?: string;
}

export function ApplicationForm({ unitId, unitInfo, propertyInfo, verifiedEmail, token }: ApplicationFormProps) {
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [signature, setSignature] = useState<{ image: string | null; typedName: string }>({ image: null, typedName: "" });
  const [docRequirements, setDocRequirements] = useState<DocRequirement[]>([]);
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, UploadedDoc>>({});
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    fetch(`/api/apply/${unitId}/fields`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.fields) {
          setFields(data.fields);
          // Pre-fill email field if verified
          if (verifiedEmail) {
            const emailField = (data.fields as Field[]).find(
              (f) => f.type === "EMAIL" || f.label.toLowerCase().includes("email")
            );
            if (emailField) {
              setAnswers((prev) => ({ ...prev, [emailField.id]: verifiedEmail }));
            }
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [unitId, verifiedEmail]);

  useEffect(() => {
    fetch(`/api/apply/${unitId}/documents`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.requirements) setDocRequirements(data.requirements);
      })
      .catch(() => {});
  }, [unitId]);

  async function uploadFile(requirementId: string, file: File) {
    setUploadingDocId(requirementId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("requirementId", requirementId);
      if (verifiedEmail) formData.append("email", verifiedEmail);

      const res = await fetch(`/api/apply/${unitId}/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setUploadedDocs((prev) => ({ ...prev, [requirementId]: data }));
      } else {
        setError(data.error || "Upload failed");
      }
    } catch {
      setError("Upload failed");
    } finally {
      setUploadingDocId(null);
    }
  }

  function removeDoc(requirementId: string) {
    setUploadedDocs((prev) => {
      const next = { ...prev };
      delete next[requirementId];
      return next;
    });
  }

  function setAnswer(fieldId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
  }

  // Get applicant info from answers
  function getApplicantInfo() {
    const nameField = fields.find((f) => f.label.toLowerCase().includes("full legal name") || f.label.toLowerCase().includes("full name"));
    const emailField = fields.find((f) => f.type === "EMAIL" || f.label.toLowerCase().includes("email"));
    const phoneField = fields.find((f) => f.section === "PERSONAL" && (f.type === "PHONE" || f.label.toLowerCase().includes("phone")));

    return {
      name: nameField ? answers[nameField.id] || "" : "",
      email: emailField ? answers[emailField.id] || "" : "",
      phone: phoneField ? answers[phoneField.id] || "" : "",
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const applicant = getApplicantInfo();
    if (!applicant.name.trim()) {
      setError("Please enter your full name");
      setSubmitting(false);
      return;
    }

    // Validate required documents
    const missingDocs = docRequirements
      .filter((d) => d.required && !uploadedDocs[d.id])
      .map((d) => d.label);
    if (missingDocs.length > 0) {
      setError(`Please upload required documents: ${missingDocs.join(", ")}`);
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`/api/apply/${unitId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicantName: applicant.name,
          applicantEmail: verifiedEmail || applicant.email,
          applicantPhone: applicant.phone,
          token: token || undefined,
          signatureImage: signature.image,
          signatureTypedName: signature.typedName,
          uploadedDocumentIds: Object.values(uploadedDocs).map((d) => d.id),
          answers: Object.entries(answers).map(([fieldId, value]) => ({
            fieldId,
            value,
          })),
        }),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to submit application");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
        <h2 className="text-xl font-bold">Application Submitted!</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-md">
          The property manager will review your application and get back to you.
          Thank you for your interest in {propertyInfo.name}.
        </p>
      </div>
    );
  }

  // Group fields by section
  const sections = new Map<string, Field[]>();
  for (const field of fields) {
    const list = sections.get(field.section) || [];
    list.push(field);
    sections.set(field.section, list);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {Array.from(sections.entries()).map(([section, sectionFields]) => (
        <div key={section} className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b pb-2">
            {SECTION_LABELS[section] || section}
          </h3>
          <div className="space-y-4">
            {sectionFields.map((field) => (
              <div key={field.id} className="space-y-1.5">
                <Label htmlFor={field.id}>
                  {field.label}
                  {field.required && <span className="text-red-500 ml-0.5">*</span>}
                </Label>
                {field.type === "TEXTAREA" ? (
                  <textarea
                    id={field.id}
                    value={answers[field.id] || ""}
                    onChange={(e) => setAnswer(field.id, e.target.value)}
                    required={field.required}
                    placeholder={field.placeholder || ""}
                    rows={3}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                ) : field.type === "SELECT" ? (
                  <select
                    id={field.id}
                    value={answers[field.id] || ""}
                    onChange={(e) => setAnswer(field.id, e.target.value)}
                    required={field.required}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select...</option>
                    {field.options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : field.type === "CHECKBOX" ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={field.id}
                      checked={answers[field.id] === "true"}
                      onChange={(e) => setAnswer(field.id, String(e.target.checked))}
                      className="h-4 w-4 rounded border-input"
                    />
                    <span className="text-sm text-muted-foreground">Yes</span>
                  </div>
                ) : (
                  <Input
                    id={field.id}
                    type={
                      field.type === "NUMBER"
                        ? "number"
                        : field.type === "DATE"
                          ? "date"
                          : field.type === "EMAIL"
                            ? "email"
                            : field.type === "PHONE"
                              ? "tel"
                              : "text"
                    }
                    value={answers[field.id] || ""}
                    onChange={(e) => setAnswer(field.id, e.target.value)}
                    required={field.required}
                    placeholder={field.placeholder || ""}
                    readOnly={!!(verifiedEmail && field.type === "EMAIL")}
                    className={verifiedEmail && field.type === "EMAIL" ? "bg-muted cursor-not-allowed" : ""}
                  />
                )}
                {field.helpText && (
                  <p className="text-xs text-muted-foreground">{field.helpText}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Required Documents */}
      {docRequirements.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b pb-2">
            Required Documents
          </h3>
          <div className="space-y-3">
            {docRequirements.map((req) => {
              const uploaded = uploadedDocs[req.id];
              const isUploading = uploadingDocId === req.id;
              return (
                <div
                  key={req.id}
                  className="rounded-lg border p-3 flex items-center gap-3"
                >
                  <div
                    className={
                      "h-6 w-6 rounded-full flex items-center justify-center shrink-0 " +
                      (uploaded
                        ? "bg-green-500 text-white"
                        : "border-2 border-muted-foreground/30")
                    }
                  >
                    {uploaded && <Check className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {req.label}
                      {req.required && (
                        <span className="text-red-500 ml-0.5">*</span>
                      )}
                    </p>
                    {req.description && !uploaded && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {req.description}
                      </p>
                    )}
                    {uploaded && (
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        <span className="truncate">{uploaded.fileName}</span>
                        <span>&middot; {uploaded.fileSizeMb.toFixed(1)} MB</span>
                      </p>
                    )}
                  </div>
                  <input
                    ref={(el) => { fileInputRefs.current[req.id] = el; }}
                    type="file"
                    accept={req.acceptedTypes.join(",")}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadFile(req.id, file);
                    }}
                  />
                  {uploaded ? (
                    <button
                      type="button"
                      onClick={() => removeDoc(req.id)}
                      className="text-xs text-muted-foreground hover:text-red-500 shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRefs.current[req.id]?.click()}
                      disabled={isUploading}
                      className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted shrink-0 flex items-center gap-1 disabled:opacity-50"
                    >
                      {isUploading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Upload className="h-3 w-3" />
                      )}
                      Upload
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Signature & Certification */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b pb-2">
          Signature & Certification
        </h3>
        <SignaturePad onSignatureChange={setSignature} disabled={submitting} />
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={
          submitting ||
          !signature.image ||
          !signature.typedName ||
          signature.typedName.trim().length < 2
        }
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Submitting...
          </>
        ) : (
          "Submit Application"
        )}
      </Button>
    </form>
  );
}

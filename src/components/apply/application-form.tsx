"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2 } from "lucide-react";
import { SECTION_LABELS } from "@/lib/application-fields";

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

interface ApplicationFormProps {
  unitId: string;
  unitInfo: { unitNumber: string; rent: number; bedrooms: number | null; bathrooms: number | null };
  propertyInfo: { name: string; address: string; city: string; state: string; zip: string };
}

export function ApplicationForm({ unitId, unitInfo, propertyInfo }: ApplicationFormProps) {
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`/api/apply/${unitId}/fields`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.fields) setFields(data.fields);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [unitId]);

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

    try {
      const res = await fetch(`/api/apply/${unitId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicantName: applicant.name,
          applicantEmail: applicant.email,
          applicantPhone: applicant.phone,
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

      <Button type="submit" className="w-full" disabled={submitting}>
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

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, FileDown } from "lucide-react";

interface Field {
  name: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
}

const DEFAULT_TEMPLATE_FIELDS: Field[] = [
  { name: "fullName", label: "Full Legal Name", type: "text", required: true },
  { name: "dateOfBirth", label: "Date of Birth", type: "date", required: true },
  { name: "ssnLast4", label: "SSN (Last 4 Digits)", type: "text", required: true },
  { name: "currentAddress", label: "Current Address", type: "textarea", required: true },
  { name: "phone", label: "Phone Number", type: "phone", required: true },
  { name: "email", label: "Email Address", type: "email", required: true },
  { name: "employer", label: "Current Employer", type: "text", required: true },
  { name: "position", label: "Position/Title", type: "text", required: true },
  { name: "monthlyIncome", label: "Monthly Gross Income", type: "number", required: true },
  { name: "employmentLength", label: "Length of Employment", type: "text", required: true },
  { name: "prevLandlordName", label: "Previous Landlord Name", type: "text", required: false },
  { name: "prevLandlordPhone", label: "Previous Landlord Phone", type: "phone", required: false },
  { name: "prevAddress", label: "Previous Rental Address", type: "textarea", required: false },
  { name: "reasonForLeaving", label: "Reason for Leaving", type: "text", required: false },
  { name: "lengthOfStay", label: "Length of Stay at Previous Address", type: "text", required: false },
  { name: "reference1Name", label: "Personal Reference 1 - Name", type: "text", required: true },
  { name: "reference1Phone", label: "Personal Reference 1 - Phone", type: "phone", required: true },
  { name: "reference1Relationship", label: "Personal Reference 1 - Relationship", type: "text", required: true },
  { name: "reference2Name", label: "Personal Reference 2 - Name", type: "text", required: false },
  { name: "reference2Phone", label: "Personal Reference 2 - Phone", type: "phone", required: false },
  { name: "reference2Relationship", label: "Personal Reference 2 - Relationship", type: "text", required: false },
  { name: "vehicleMakeModel", label: "Vehicle Make/Model", type: "text", required: false },
  { name: "vehicleLicensePlate", label: "License Plate Number", type: "text", required: false },
  { name: "petType", label: "Pet Type/Breed", type: "text", required: false },
  { name: "petWeight", label: "Pet Weight (lbs)", type: "number", required: false },
  { name: "authorizationConsent", label: "I authorize the landlord to verify information provided and obtain credit/background reports", type: "text", required: true },
];

const DEFAULT_TEMPLATE_DESCRIPTION =
  "This is a basic rental application template provided by DoorStax for convenience. Landlords are responsible for ensuring compliance with all applicable federal, state, and local laws including Fair Housing regulations. DoorStax is not liable for any legal issues arising from the use of this template. Consult with legal counsel to ensure compliance.";

export default function NewTemplatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<Field[]>([
    { name: "full_name", label: "Full Name", type: "text", required: true },
    { name: "email", label: "Email", type: "email", required: true },
    { name: "phone", label: "Phone", type: "phone", required: true },
  ]);

  function loadDefaultTemplate() {
    setName("Standard Rental Application");
    setDescription(DEFAULT_TEMPLATE_DESCRIPTION);
    setFields(DEFAULT_TEMPLATE_FIELDS.map((f) => ({ ...f })));
    toast.success("Default template loaded");
  }

  function addField() {
    setFields([
      ...fields,
      { name: "", label: "", type: "text", required: false },
    ]);
  }

  function removeField(index: number) {
    setFields(fields.filter((_, i) => i !== index));
  }

  function updateField(index: number, key: keyof Field, value: unknown) {
    const updated = [...fields];
    if (key === "label") {
      updated[index].label = value as string;
      updated[index].name = (value as string)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
    } else {
      (updated[index] as unknown as Record<string, unknown>)[key] = value;
    }
    setFields(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Template name is required");
      return;
    }
    if (fields.length === 0) {
      toast.error("Add at least one field");
      return;
    }
    setLoading(true);

    try {
      const res = await fetch("/api/applications/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
          fields,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to create template");
        setLoading(false);
        return;
      }

      toast.success("Template created");
      router.push("/dashboard/applications/templates");
    } catch {
      toast.error("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/applications/templates"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Templates
      </Link>

      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Create Template"
          description="Design a custom rental application form."
        />
        <Button type="button" variant="outline" onClick={loadDefaultTemplate}>
          <FileDown className="mr-2 h-4 w-4" />
          Use Default Template
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Template Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Standard Rental Application"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this template for?"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Fields</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addField}>
              <Plus className="mr-2 h-3.5 w-3.5" />
              Add Field
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, i) => (
              <div key={i} className="flex items-end gap-3 rounded-lg border border-border p-3">
                <div className="flex-1 space-y-2">
                  <Label>Label</Label>
                  <Input
                    value={field.label}
                    onChange={(e) => updateField(i, "label", e.target.value)}
                    placeholder="Field label"
                    required
                  />
                </div>
                <div className="w-36 space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={field.type}
                    onValueChange={(v) => updateField(i, "type", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="phone">Phone</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="textarea">Textarea</SelectItem>
                      <SelectItem value="select">Dropdown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) => updateField(i, "required", e.target.checked)}
                      className="rounded"
                    />
                    Required
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeField(i)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create Template"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

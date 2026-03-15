"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "sonner";
import { ImagePlus, X } from "lucide-react";

interface PropertyWithUnits {
  id: string;
  name: string;
  units: { id: string; unitNumber: string }[];
}

interface TenantItem {
  tenantId: string;
  userId: string;
  name: string;
  email: string;
  unitId: string;
}

const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"];

function ComposeMessageForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialType = searchParams.get("type") === "ANNOUNCEMENT" ? "ANNOUNCEMENT" : "DIRECT";

  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<"DIRECT" | "ANNOUNCEMENT">(initialType);
  const [properties, setProperties] = useState<PropertyWithUnits[]>([]);
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [selectedProperty, setSelectedProperty] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");
  const [selectedTenant, setSelectedTenant] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch("/api/properties")
      .then((r) => r.json())
      .then(setProperties);
  }, []);

  // Load tenants when unit is selected (for DIRECT messages)
  useEffect(() => {
    if (!selectedUnit || type !== "DIRECT") {
      setTenants([]);
      setSelectedTenant("");
      return;
    }
    fetch(`/api/tenants?unitId=${selectedUnit}`)
      .then((r) => r.json())
      .then((data: TenantItem[]) => {
        setTenants(data);
        if (data.length === 1) setSelectedTenant(data[0].userId);
      });
  }, [selectedUnit, type]);

  const units = properties.find((p) => p.id === selectedProperty)?.units || [];

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        setImageUrl(data.url);
      } else {
        toast.error("Failed to upload image");
      }
    } catch {
      toast.error("Upload failed");
    }
    setUploading(false);
    e.target.value = "";
  }

  function handleTypeChange(newType: "DIRECT" | "ANNOUNCEMENT") {
    setType(newType);
    setSelectedProperty("");
    setSelectedUnit("");
    setSelectedTenant("");
    setTenants([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!subject.trim() || !body.trim()) {
      toast.error("Subject and message body are required");
      return;
    }

    if (type === "DIRECT" && !selectedTenant) {
      toast.error("Please select a tenant");
      return;
    }

    setLoading(true);

    try {
      const payload: Record<string, string> = {
        type,
        subject,
        body,
        priority,
      };

      if (type === "DIRECT") {
        payload.recipientId = selectedTenant;
      }

      if (selectedProperty && selectedProperty !== "all") {
        payload.propertyId = selectedProperty;
      }

      if (imageUrl) payload.imageUrl = imageUrl;

      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to send message");
        setLoading(false);
        return;
      }

      toast.success(
        type === "DIRECT" ? "Message sent!" : "Announcement sent!"
      );
      router.push("/dashboard/messages");
    } catch {
      toast.error("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={type === "DIRECT" ? "New Message" : "New Announcement"}
        description={
          type === "DIRECT"
            ? "Send a direct message to a tenant."
            : "Send an announcement to multiple tenants."
        }
      />

      <Card className="max-w-lg border-border">
        <CardHeader>
          <CardTitle>Compose</CardTitle>
          <CardDescription>
            Choose the message type and fill in the details below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type toggle */}
            <div className="space-y-2">
              <Label>Type</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={type === "DIRECT" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleTypeChange("DIRECT")}
                >
                  Direct Message
                </Button>
                <Button
                  type="button"
                  variant={type === "ANNOUNCEMENT" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleTypeChange("ANNOUNCEMENT")}
                >
                  Announcement
                </Button>
              </div>
            </div>

            {/* Property select */}
            <div className="space-y-2">
              <Label>Property</Label>
              <Select
                value={selectedProperty}
                onValueChange={(v) => {
                  setSelectedProperty(v);
                  setSelectedUnit("");
                  setSelectedTenant("");
                }}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      type === "ANNOUNCEMENT"
                        ? "All Properties"
                        : "Select property"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {type === "ANNOUNCEMENT" && (
                    <SelectItem value="all">All Properties</SelectItem>
                  )}
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Unit select (DIRECT only) */}
            {type === "DIRECT" && selectedProperty && (
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select
                  value={selectedUnit}
                  onValueChange={setSelectedUnit}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        Unit {u.unitNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Tenant select (DIRECT only) */}
            {type === "DIRECT" && tenants.length > 1 && (
              <div className="space-y-2">
                <Label>Tenant</Label>
                <Select
                  value={selectedTenant}
                  onValueChange={setSelectedTenant}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map((t) => (
                      <SelectItem key={t.userId} value={t.userId}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                placeholder="Enter subject"
              />
            </div>

            {/* Body */}
            <div className="space-y-2">
              <Label htmlFor="body">Message</Label>
              <textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                placeholder="Write your message..."
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            {/* Image attachment */}
            <div className="space-y-2">
              <Label>Image (optional)</Label>
              {imageUrl ? (
                <div className="relative inline-block">
                  <Image
                    src={imageUrl}
                    alt="Attachment"
                    width={200}
                    height={150}
                    className="rounded border border-border object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-white text-xs flex items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <Button type="button" variant="outline" size="sm" asChild disabled={uploading}>
                    <span>
                      <ImagePlus className="mr-1 h-3 w-3" />
                      {uploading ? "Uploading..." : "Attach Image"}
                    </span>
                  </Button>
                </label>
              )}
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p.charAt(0) + p.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                disabled={loading}
              >
                {loading
                  ? "Sending..."
                  : type === "DIRECT"
                  ? "Send Message"
                  : "Send Announcement"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ComposeMessagePage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">Loading...</div>}>
      <ComposeMessageForm />
    </Suspense>
  );
}

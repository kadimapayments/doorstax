"use client";

import { useEffect, useState } from "react";
import { Send, Copy, Check, Link } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Unit {
  id: string;
  unitNumber: string;
  rentAmount: number;
  status: string;
}

interface Property {
  id: string;
  name: string;
  units: Unit[];
}

interface InviteToApplyDialogProps {
  trigger?: React.ReactNode;
}

export function InviteToApplyDialog({ trigger }: InviteToApplyDialogProps) {
  const [open, setOpen] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [copied, setCopied] = useState(false);

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);
  const units = selectedProperty?.units ?? [];
  const applicationUrl = selectedUnitId
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/apply/${selectedUnitId}`
    : "";

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    fetch("/api/properties")
      .then((r) => r.json())
      .then((data: Property[]) => {
        setProperties(data);
      })
      .catch(() => {
        setProperties([]);
      })
      .finally(() => setLoading(false));
  }, [open]);

  function resetForm() {
    setSelectedPropertyId("");
    setSelectedUnitId("");
    setCopied(false);
  }

  async function handleCopy() {
    if (!applicationUrl) return;

    try {
      await navigator.clipboard.writeText(applicationUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the input text
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Send className="mr-2 h-4 w-4" />
            Invite to Apply
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite to Apply</DialogTitle>
          <DialogDescription>
            Generate a link for a prospective tenant to complete a rental
            application for a specific unit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">
              Loading properties...
            </p>
          ) : properties.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No properties found. Create a property first.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Property</Label>
                <Select
                  value={selectedPropertyId}
                  onValueChange={(val) => {
                    setSelectedPropertyId(val);
                    setSelectedUnitId("");
                    setCopied(false);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a property" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedPropertyId && (
                <div className="space-y-2">
                  <Label>Unit</Label>
                  {units.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No units found for this property.
                    </p>
                  ) : (
                    <Select
                      value={selectedUnitId}
                      onValueChange={(val) => {
                        setSelectedUnitId(val);
                        setCopied(false);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a unit" />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            Unit {u.unitNumber}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {selectedUnitId && (
                <div className="space-y-2">
                  <Label>Application Link</Label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Link className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        readOnly
                        value={applicationUrl}
                        className="pl-9"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCopy}
                      className="shrink-0"
                    >
                      {copied ? (
                        <>
                          <Check className="mr-1 h-3 w-3" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="mr-1 h-3 w-3" />
                          Copy Link
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Share this link with the prospective tenant to complete their
                    application.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

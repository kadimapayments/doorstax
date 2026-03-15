"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Key, Shield, Terminal, Loader2, Check, Eye, EyeOff } from "lucide-react";

interface MerchantKeysFormProps {
  userId: string;
  initialApiKey: string | null;
  initialWebhookSecret: string | null;
  initialTerminalId: string | null;
}

export function MerchantKeysForm({
  userId,
  initialApiKey,
  initialWebhookSecret,
  initialTerminalId,
}: MerchantKeysFormProps) {
  const [apiKey, setApiKey] = useState(initialApiKey || "");
  const [webhookSecret, setWebhookSecret] = useState(initialWebhookSecret || "");
  const [terminalId, setTerminalId] = useState(initialTerminalId || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  const hasChanges =
    apiKey !== (initialApiKey || "") ||
    webhookSecret !== (initialWebhookSecret || "") ||
    terminalId !== (initialTerminalId || "");

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);

    try {
      const res = await fetch(`/api/admin/landlords/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kadimaMerchantApiKey: apiKey,
          kadimaMerchantWebhookSecret: webhookSecret,
          kadimaMerchantTerminalId: terminalId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to save (${res.status})`);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Key className="h-5 w-5 text-muted-foreground" />
          Kadima Merchant Credentials
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Set the merchant-level API key, webhook secret, and terminal ID for this property manager.
          These credentials are assigned after merchant approval in the Kadima dashboard.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="merchantApiKey" className="flex items-center gap-1.5">
            <Key className="h-3.5 w-3.5" />
            Merchant API Key
          </Label>
          <div className="relative">
            <Input
              id="merchantApiKey"
              type={showApiKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="e.g. MDg.sbg9MgVgs-rwWpuucZAbE6AWW4aBzfD8"
              className="pr-10 font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="merchantWebhookSecret" className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Merchant Webhook Secret
          </Label>
          <div className="relative">
            <Input
              id="merchantWebhookSecret"
              type={showWebhookSecret ? "text" : "password"}
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="e.g. pKXHTq9eLxIC2TP0G7KdxYDhADtwm92P"
              className="pr-10 font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => setShowWebhookSecret(!showWebhookSecret)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showWebhookSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="merchantTerminalId" className="flex items-center gap-1.5">
            <Terminal className="h-3.5 w-3.5" />
            Merchant Terminal ID
          </Label>
          <Input
            id="merchantTerminalId"
            type="text"
            value={terminalId}
            onChange={(e) => setTerminalId(e.target.value)}
            placeholder="e.g. 7000"
            className="font-mono text-sm"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving || !hasChanges} size="sm">
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : saved ? (
            <Check className="mr-2 h-4 w-4" />
          ) : null}
          {saving ? "Saving..." : saved ? "Saved" : "Save Credentials"}
        </Button>
        {!hasChanges && !saved && (
          <span className="text-xs text-muted-foreground">No changes</span>
        )}
      </div>
    </div>
  );
}

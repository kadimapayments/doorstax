"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, FileText, ExternalLink, Send, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface Props {
  vendorId: string;
  vendorName: string;
  vendorEmail: string | null;
  taxId: string | null;
  taxIdType: string | null;
  w9Status: string | null;
  w9DocumentUrl: string | null;
  totalSpend: number;
}

export function VendorW9Manager({ vendorId, vendorEmail, taxId, taxIdType, w9Status, w9DocumentUrl, totalSpend }: Props) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [showTaxFields, setShowTaxFields] = useState(false);
  const [taxIdInput, setTaxIdInput] = useState(taxId || "");
  const [taxIdTypeInput, setTaxIdTypeInput] = useState(taxIdType || "EIN");
  const [savingTax, setSavingTax] = useState(false);

  async function handleUploadW9(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "w9");
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) { toast.error("Upload failed"); return; }
      const { url } = await uploadRes.json();

      const res = await fetch(`/api/vendors/${vendorId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ w9DocumentUrl: url, w9Status: "RECEIVED" }),
      });
      if (res.ok) {
        toast.success("W-9 uploaded successfully");
        router.refresh();
      } else {
        toast.error("Failed to save W-9");
      }
    } catch { toast.error("Upload failed"); }
    finally { setUploading(false); }
  }

  async function handleVerifyW9() {
    const res = await fetch(`/api/vendors/${vendorId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ w9Status: "VERIFIED" }),
    });
    if (res.ok) {
      toast.success("W-9 marked as verified");
      router.refresh();
    } else {
      toast.error("Failed to verify");
    }
  }

  async function handleRequestW9() {
    if (!vendorEmail) { toast.error("Vendor has no email"); return; }
    setRequesting(true);
    try {
      const res = await fetch(`/api/vendors/${vendorId}/request-w9`, { method: "POST" });
      if (res.ok) {
        toast.success(`W-9 request sent to ${vendorEmail}`);
        router.refresh();
      } else {
        toast.error("Failed to send request");
      }
    } catch { toast.error("Something went wrong"); }
    finally { setRequesting(false); }
  }

  async function handleSaveTaxId() {
    setSavingTax(true);
    try {
      const res = await fetch(`/api/vendors/${vendorId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxId: taxIdInput || null, taxIdType: taxIdTypeInput || null }),
      });
      if (res.ok) {
        toast.success("Tax ID saved");
        setShowTaxFields(false);
        router.refresh();
      }
    } catch { toast.error("Failed to save"); }
    finally { setSavingTax(false); }
  }

  return (
    <div className="space-y-3">
      {/* Tax ID */}
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Tax ID</span>
        <span>{taxId ? "•••" + taxId.slice(-4) : <button onClick={() => setShowTaxFields(true)} className="text-primary hover:underline text-xs">Add Tax ID</button>}</span>
      </div>
      {taxId && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Tax ID Type</span>
          <span>{taxIdType || "—"}</span>
        </div>
      )}

      {showTaxFields && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Tax ID (EIN/SSN)</Label>
              <Input value={taxIdInput} onChange={(e) => setTaxIdInput(e.target.value)} placeholder="XX-XXXXXXX" className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Type</Label>
              <select value={taxIdTypeInput} onChange={(e) => setTaxIdTypeInput(e.target.value)} className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm">
                <option value="EIN">EIN</option>
                <option value="SSN">SSN</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSaveTaxId} disabled={savingTax}>{savingTax ? "Saving..." : "Save"}</Button>
            <Button variant="outline" size="sm" onClick={() => setShowTaxFields(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* W-9 Status */}
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">W-9 Status</span>
        <span className={cn(
          "text-xs px-1.5 py-0.5 rounded",
          w9Status === "VERIFIED" ? "bg-emerald-500/10 text-emerald-500" :
          w9Status === "RECEIVED" ? "bg-blue-500/10 text-blue-500" :
          w9Status === "REQUESTED" ? "bg-amber-500/10 text-amber-500" :
          "bg-muted text-muted-foreground"
        )}>
          {w9Status?.replace(/_/g, " ") || "Not requested"}
        </span>
      </div>

      {/* W-9 Document */}
      {w9DocumentUrl && (
        <div className="flex items-center justify-between text-sm">
          <a href={w9DocumentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline text-xs">
            <FileText className="h-3 w-3" />
            View W-9 Document
            <ExternalLink className="h-3 w-3" />
          </a>
          {w9Status !== "VERIFIED" && (
            <Button variant="outline" size="sm" onClick={handleVerifyW9} className="h-7 text-xs">
              <CheckCircle className="mr-1 h-3 w-3" />
              Mark Verified
            </Button>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-2 border-t">
        <label className="cursor-pointer">
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleUploadW9} className="hidden" />
          <span className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted cursor-pointer">
            <Upload className="h-3 w-3" />
            {uploading ? "Uploading..." : "Upload W-9"}
          </span>
        </label>
        {vendorEmail && w9Status !== "VERIFIED" && (
          <Button variant="outline" size="sm" onClick={handleRequestW9} disabled={requesting} className="h-7 text-xs">
            <Send className="mr-1 h-3 w-3" />
            {requesting ? "Sending..." : "Request W-9"}
          </Button>
        )}
      </div>

      {/* 1099 Warning */}
      {totalSpend >= 600 && w9Status !== "VERIFIED" && (
        <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-2 text-xs text-amber-500">
          ⚠ Total spend exceeds $600 — W-9 required for 1099 filing.
        </div>
      )}

      {/* Tax Center Link */}
      <a href="/dashboard/tax-center" className="flex items-center gap-1 text-xs text-primary hover:underline pt-1">
        <FileText className="h-3 w-3" />
        Go to Tax Center →
      </a>
    </div>
  );
}

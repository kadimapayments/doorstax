"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  CheckCircle2,
  User,
  CreditCard,
  Building2,
  Users,
  Rocket,
  Plus,
  Trash2,
  SkipForward,
  ArrowRight,
  ArrowLeft,
  ClipboardCheck,
  FileUp,
  FileText,
  Upload,
  X,
} from "lucide-react";
import { KadimaCardForm, type CardFormResult } from "@/components/payments/kadima-card-form";
import { AchBankForm, type AchFormResult } from "@/components/payments/ach-bank-form";

const STEPS = [
  "Personal Details",
  "Payment Method",
  "Roommates",
  "Move-In Checklist",
  "Documents",
  "Lease Review",
  "Complete",
];

interface OnboardingData {
  profileId: string;
  name: string;
  email: string;
  phone: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  property: string;
  address: string;
  unit: string;
  rentAmount: number;
  landlordId: string;
  onboardingComplete: boolean;
  hasPaymentMethod: boolean;
  onboardingStep?: string;
  leaseAcknowledgedAt?: string | null;
}

interface Roommate {
  name: string;
  email: string;
  phone: string;
}

interface ChecklistItem {
  area: string;
  item: string;
  condition: string;
  notes: string;
  acknowledged: boolean;
}

interface TenantDoc {
  id: string;
  type: string;
  name: string;
  url: string;
  createdAt: string;
  verifiedAt: string | null;
}

interface LeaseInfo {
  lease: {
    id: string;
    startDate: string;
    endDate: string | null;
    rentAmount: number;
    securityDeposit: number | null;
    terms: string | null;
    signedByTenant: boolean;
  } | null;
  unit: string;
  property: string;
  acknowledged: boolean;
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export default function TenantOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Step 1 fields
  const [phone, setPhone] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  // Step 2
  const [paymentSaved, setPaymentSaved] = useState(false);
  const [paymentTab, setPaymentTab] = useState<"card" | "ach">("card");
  const [hostedToken, setHostedToken] = useState<string | null>(null);
  const [cardFormLoading, setCardFormLoading] = useState(false);
  const [cardSaving, setCardSaving] = useState(false);

  // Step 3
  const [roommates, setRoommates] = useState<Roommate[]>([]);
  const [roommatesSubmitted, setRoommatesSubmitted] = useState(false);

  // Step 4: Move-In Checklist
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [checklistId, setChecklistId] = useState<string | null>(null);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [checklistFetched, setChecklistFetched] = useState(false);
  const [noChecklist, setNoChecklist] = useState(false);

  // Step 5: Documents
  const [documents, setDocuments] = useState<TenantDoc[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsFetched, setDocsFetched] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Step 6: Lease Review
  const [leaseInfo, setLeaseInfo] = useState<LeaseInfo | null>(null);
  const [leaseLoading, setLeaseLoading] = useState(false);
  const [leaseFetched, setLeaseFetched] = useState(false);
  const [leaseAcked, setLeaseAcked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let retries = 0;
    const maxRetries = 3;

    async function fetchOnboardingData() {
      try {
        const r = await fetch("/api/tenant/onboarding");
        if (r.ok) {
          const d = await r.json();
          if (cancelled) return;
          setData(d);
          setPhone(d.phone || "");
          setEmergencyName(d.emergencyContactName || "");
          setEmergencyPhone(d.emergencyContactPhone || "");
          setPaymentSaved(d.hasPaymentMethod);
          if (d.onboardingComplete) {
            router.replace("/tenant");
          }
          setFetching(false);
          return;
        }
        // Session may not have propagated yet — retry on 401
        if (r.status === 401 && retries < maxRetries) {
          retries++;
          setTimeout(fetchOnboardingData, 1000);
          return;
        }
        if (!cancelled) setFetching(false);
      } catch {
        if (retries < maxRetries) {
          retries++;
          setTimeout(fetchOnboardingData, 1000);
          return;
        }
        if (!cancelled) setFetching(false);
      }
    }

    fetchOnboardingData();
    return () => { cancelled = true; };
  }, [router]);

  // Fetch checklist when entering step 4
  useEffect(() => {
    if (step !== 4 || checklistFetched) return;
    setChecklistLoading(true);
    fetch("/api/tenant/onboarding/checklist")
      .then((r) => {
        if (r.status === 404) {
          setNoChecklist(true);
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (d) {
          setChecklistId(d.id);
          setChecklistItems(d.items || []);
        }
        setChecklistFetched(true);
      })
      .catch(() => {
        setNoChecklist(true);
        setChecklistFetched(true);
      })
      .finally(() => setChecklistLoading(false));
  }, [step, checklistFetched]);

  // Fetch documents when entering step 5
  useEffect(() => {
    if (step !== 5 || docsFetched) return;
    setDocsLoading(true);
    fetch("/api/tenant/onboarding/documents")
      .then((r) => r.json())
      .then((d) => {
        setDocuments(d.documents || []);
        setDocsFetched(true);
      })
      .catch(() => setDocsFetched(true))
      .finally(() => setDocsLoading(false));
  }, [step, docsFetched]);

  // Fetch lease when entering step 6
  useEffect(() => {
    if (step !== 6 || leaseFetched) return;
    setLeaseLoading(true);
    fetch("/api/tenant/onboarding/lease-ack")
      .then((r) => {
        if (r.status === 404) return null;
        return r.json();
      })
      .then((d) => {
        if (d) {
          setLeaseInfo(d);
          setLeaseAcked(d.acknowledged || false);
        }
        setLeaseFetched(true);
      })
      .catch(() => setLeaseFetched(true))
      .finally(() => setLeaseLoading(false));
  }, [step, leaseFetched]);

  // Handle Kadima hosted fields card save result
  // NOTE: must be before early returns so hook order is stable
  const handleCardSuccess = useCallback(
    async (data: CardFormResult) => {
      setCardSaving(true);
      try {
        const cardToken = data.cardToken || data.cardId || data.customerId;
        if (!cardToken) {
          toast.error("Card tokenization failed. Please try again.");
          setCardSaving(false);
          return;
        }
        const res = await fetch("/api/tenant/onboarding/payment-method", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "card",
            cardToken,
            cardBrand: data.cardBrand || null,
            cardLast4: data.lastFour || null,
            exp: data.exp || null,
          }),
        });

        if (res.ok) {
          setPaymentSaved(true);
          setHostedToken(null);
          toast.success("Card saved successfully!");
        } else {
          const err = await res.json();
          toast.error(err.error || "Failed to save card");
        }
      } catch {
        toast.error("Something went wrong");
      } finally {
        setCardSaving(false);
      }
    },
    []
  );

  // Handle ACH bank account save result
  const handleAchSuccess = useCallback((data: AchFormResult) => {
    setPaymentSaved(true);
    toast.success("Bank account saved successfully!");
  }, []);

  // Helper to update onboarding step on transitions
  async function updateOnboardingStep(stepName: string) {
    try {
      await fetch("/api/tenant/onboarding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboardingStep: stepName }),
      });
    } catch {
      // Non-blocking
    }
  }

  if (fetching) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">
          Your tenant profile is being set up. Please check back soon.
        </p>
      </div>
    );
  }

  /* ── Step 1: Personal Details ── */
  async function savePersonalDetails() {
    setLoading(true);
    try {
      const res = await fetch("/api/tenant/onboarding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          emergencyContactName: emergencyName || undefined,
          emergencyContactPhone: emergencyPhone || undefined,
          onboardingStep: "PAYMENT_METHOD",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to save");
        return;
      }
      toast.success("Details saved!");
      setStep(2);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  /* ── Step 2: Payment Method (Kadima Hosted Fields) ── */
  async function initHostedFields() {
    setCardFormLoading(true);
    try {
      // Ensure vault customer exists before loading hosted fields
      const vaultRes = await fetch("/api/tenant/vault-status");
      if (vaultRes.ok) {
        const vaultData = await vaultRes.json();
        if (!vaultData.hasVaultCustomer) {
          const provisionRes = await fetch("/api/tenant/vault-status", { method: "POST" });
          if (!provisionRes.ok) {
            toast.error("Unable to set up payment vault. Please try again.");
            setCardFormLoading(false);
            return;
          }
        }
      }

      const tokenRes = await fetch("/api/payments/hosted-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: window.location.origin, saveCard: "required" }),
      });
      if (!tokenRes.ok) {
        toast.error("Failed to load secure payment form");
        setCardFormLoading(false);
        return;
      }
      const tokenData = await tokenRes.json();
      setHostedToken(tokenData.token);
    } catch {
      toast.error("Failed to initialize payment form");
    } finally {
      setCardFormLoading(false);
    }
  }

  function handleCardError(message: string) {
    toast.error(message || "Card tokenization failed");
  }

  function goToStep3() {
    updateOnboardingStep("ROOMMATES");
    setStep(3);
  }

  /* ── Step 3: Roommates ── */
  function addRoommate() {
    setRoommates([...roommates, { name: "", email: "", phone: "" }]);
  }

  function removeRoommate(idx: number) {
    setRoommates(roommates.filter((_, i) => i !== idx));
  }

  function updateRoommate(idx: number, field: keyof Roommate, value: string) {
    const updated = [...roommates];
    updated[idx] = { ...updated[idx], [field]: value };
    setRoommates(updated);
  }

  async function submitRoommates() {
    if (roommates.length === 0) {
      updateOnboardingStep("MOVE_IN_CHECKLIST");
      setStep(4);
      return;
    }

    // Validate
    for (const rm of roommates) {
      if (!rm.name || !rm.email) {
        toast.error("Please fill in name and email for all roommates");
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch("/api/roommate-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roommates }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to submit roommate requests");
        return;
      }

      setRoommatesSubmitted(true);
      toast.success("Roommate requests submitted for approval!");
      updateOnboardingStep("MOVE_IN_CHECKLIST");
      setStep(4);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  /* ── Step 4: Move-In Checklist ── */
  function toggleChecklistItem(idx: number) {
    const updated = [...checklistItems];
    updated[idx] = { ...updated[idx], acknowledged: !updated[idx].acknowledged };
    setChecklistItems(updated);
  }

  function updateChecklistNotes(idx: number, notes: string) {
    const updated = [...checklistItems];
    updated[idx] = { ...updated[idx], notes };
    setChecklistItems(updated);
  }

  async function saveChecklist() {
    setLoading(true);
    try {
      const res = await fetch("/api/tenant/onboarding/checklist", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: checklistItems }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to save checklist");
        return;
      }
      toast.success("Checklist saved!");
      updateOnboardingStep("DOCUMENTS");
      setStep(5);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function skipChecklist() {
    updateOnboardingStep("DOCUMENTS");
    setStep(5);
  }

  /* ── Step 5: Documents ── */
  async function uploadDocument(file: File, docType: string) {
    setUploading(true);
    try {
      // 1. Upload file
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!uploadRes.ok) {
        toast.error("Failed to upload file");
        return;
      }
      const { url } = await uploadRes.json();

      // 2. Save metadata
      const res = await fetch("/api/tenant/onboarding/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: docType, name: file.name, url }),
      });
      if (!res.ok) {
        toast.error("Failed to save document");
        return;
      }
      const saved = await res.json();
      setDocuments((prev) => [...prev, saved]);
      toast.success("Document uploaded!");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setUploading(false);
    }
  }

  async function deleteDocument(docId: string) {
    try {
      const res = await fetch(`/api/tenant/onboarding/documents?id=${docId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
        toast.success("Document removed");
      }
    } catch {
      toast.error("Failed to remove document");
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>, docType: string) {
    const file = e.target.files?.[0];
    if (file) {
      uploadDocument(file, docType);
    }
    e.target.value = "";
  }

  function goToStep6() {
    updateOnboardingStep("LEASE_ACKNOWLEDGMENT");
    setStep(6);
  }

  /* ── Step 6: Lease Review ── */
  async function acknowledgeLease() {
    setLoading(true);
    try {
      const res = await fetch("/api/tenant/onboarding/lease-ack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acknowledged: true }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to acknowledge lease");
        return;
      }
      setLeaseAcked(true);
      toast.success("Lease acknowledged!");
      updateOnboardingStep("COMPLETE");
      setStep(7);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function skipLease() {
    updateOnboardingStep("COMPLETE");
    setStep(7);
  }

  /* ── Step 7: Complete ── */
  async function completeOnboarding() {
    setLoading(true);
    try {
      const res = await fetch("/api/tenant/onboarding/complete", {
        method: "POST",
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to complete onboarding");
        return;
      }

      toast.success("Welcome to DoorStax!");
      router.push("/tenant");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const stepIcons = [User, CreditCard, Users, ClipboardCheck, FileUp, FileText, Rocket];

  // Group checklist items by area
  const checklistByArea = checklistItems.reduce<Record<string, { item: ChecklistItem; idx: number }[]>>(
    (acc, item, idx) => {
      const area = item.area || "General";
      if (!acc[area]) acc[area] = [];
      acc[area].push({ item, idx });
      return acc;
    },
    {}
  );
  const allAcknowledged = checklistItems.length > 0 && checklistItems.every((i) => i.acknowledged);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-8">
        {/* Logo */}
        <div className="text-center">
          <Image
            src="/logo-dark.svg"
            alt="DoorStax"
            width={140}
            height={32}
            priority
            className="mx-auto dark:hidden"
          />
          <Image
            src="/logo-white.svg"
            alt="DoorStax"
            width={140}
            height={32}
            priority
            className="mx-auto hidden dark:block"
          />
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-1">
          {STEPS.map((label, i) => {
            const stepNum = i + 1;
            const Icon = stepIcons[i];
            const isActive = step === stepNum;
            const isComplete = step > stepNum;

            return (
              <div key={label} className="flex items-center">
                {i > 0 && (
                  <div
                    className={`h-0.5 w-4 sm:w-8 mx-0.5 sm:mx-1 transition-colors ${
                      isComplete ? "bg-primary" : "bg-border"
                    }`}
                  />
                )}
                <div
                  className={`flex items-center gap-1 sm:gap-1.5 rounded-full px-2 sm:px-3 py-1.5 text-xs font-medium transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isComplete
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isComplete ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <Icon className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden lg:inline">{label}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Step 1: Personal Details ── */}
        {step === 1 && (
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Welcome to DoorStax!</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Let&apos;s get you set up at{" "}
                <strong>
                  {data.property} — Unit {data.unit}
                </strong>
                . Your monthly rent is{" "}
                <strong>{formatMoney(data.rentAmount)}</strong>.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" value={data.name} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={data.email} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <PhoneInput
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-sm font-medium mb-3">
                  Emergency Contact{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="emergencyName">Name</Label>
                    <Input
                      id="emergencyName"
                      placeholder="Jane Smith"
                      value={emergencyName}
                      onChange={(e) => setEmergencyName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergencyPhone">Phone</Label>
                    <PhoneInput
                      id="emergencyPhone"
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <Button
                onClick={savePersonalDetails}
                disabled={loading}
                className="w-full"
              >
                {loading ? "Saving..." : "Continue"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Step 2: Payment Method ── */}
        {step === 2 && (
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Add a Payment Method</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Add a card or bank account for quick and easy rent payments.
                Your payment info is securely tokenized.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {paymentSaved ? (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-center space-y-2">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                  <p className="text-sm font-medium">
                    Payment method saved successfully!
                  </p>
                </div>
              ) : (
                <>
                  {/* Card / ACH toggle tabs */}
                  <div className="flex rounded-lg border border-border overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setPaymentTab("card")}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                        paymentTab === "card"
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      <CreditCard className="h-4 w-4" />
                      Debit / Credit Card
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentTab("ach")}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                        paymentTab === "ach"
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      <Building2 className="h-4 w-4" />
                      Bank Account (ACH)
                    </button>
                  </div>

                  {/* Card tab */}
                  {paymentTab === "card" && (
                    <>
                      {hostedToken ? (
                        <div className="space-y-3">
                          <KadimaCardForm
                            token={hostedToken}
                            onSuccess={handleCardSuccess}
                            onError={handleCardError}
                          />
                          {cardSaving && (
                            <div className="text-sm text-muted-foreground text-center py-2">
                              Saving card...
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-border p-6 text-center space-y-3">
                          <CreditCard className="h-10 w-10 text-muted-foreground mx-auto" />
                          <p className="text-sm text-muted-foreground">
                            Securely add a debit or credit card for rent payments.
                          </p>
                          <Button
                            onClick={initHostedFields}
                            disabled={cardFormLoading}
                          >
                            <CreditCard className="mr-2 h-4 w-4" />
                            {cardFormLoading ? "Loading..." : "Add Card"}
                          </Button>
                        </div>
                      )}
                    </>
                  )}

                  {/* ACH tab */}
                  {paymentTab === "ach" && (
                    <AchBankForm
                      onSuccess={handleAchSuccess}
                      onError={handleCardError}
                    />
                  )}

                  <p className="text-xs text-muted-foreground text-center">
                    You can also add a payment method later from the Pay Rent page.
                  </p>
                </>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="flex-1"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                {paymentSaved ? (
                  <Button onClick={goToStep3} className="flex-1">
                    Next
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={goToStep3}
                    className="flex-1"
                  >
                    Skip for Now
                    <SkipForward className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 3: Roommates ── */}
        {step === 3 && (
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Roommates</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Will anyone else be living with you? Add their info below and
                your property manager will review and send them an invite.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {roommates.length === 0 && !roommatesSubmitted && (
                <div className="rounded-lg border border-dashed border-border p-6 text-center space-y-3">
                  <Users className="h-10 w-10 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">
                    No roommates added yet. Click below if you have roommates
                    who need access to the portal.
                  </p>
                </div>
              )}

              {roommatesSubmitted && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-center space-y-2">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                  <p className="text-sm font-medium">
                    Roommate requests submitted!
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Your property manager will review and send invitations.
                  </p>
                </div>
              )}

              {!roommatesSubmitted &&
                roommates.map((rm, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-border p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        Roommate {idx + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-destructive hover:text-destructive"
                        onClick={() => removeRoommate(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Full Name *</Label>
                        <Input
                          placeholder="John Smith"
                          value={rm.name}
                          onChange={(e) =>
                            updateRoommate(idx, "name", e.target.value)
                          }
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Email *</Label>
                        <Input
                          type="email"
                          placeholder="john@email.com"
                          value={rm.email}
                          onChange={(e) =>
                            updateRoommate(idx, "email", e.target.value)
                          }
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Phone</Label>
                        <PhoneInput
                          value={rm.phone}
                          onChange={(e) =>
                            updateRoommate(idx, "phone", e.target.value)
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}

              {!roommatesSubmitted && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={addRoommate}
                  className="w-full"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Roommate
                </Button>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setStep(2)}
                  className="flex-1"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                {!roommatesSubmitted ? (
                  <Button
                    onClick={submitRoommates}
                    disabled={loading}
                    className="flex-1"
                  >
                    {loading
                      ? "Submitting..."
                      : roommates.length > 0
                      ? "Submit for Approval"
                      : "No Roommates — Continue"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button onClick={() => { updateOnboardingStep("MOVE_IN_CHECKLIST"); setStep(4); }} className="flex-1">
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 4: Move-In Checklist ── */}
        {step === 4 && (
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Move-In Checklist</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Review and acknowledge the condition of your unit. Check each
                item and add notes for anything that needs attention.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {checklistLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading checklist...
                </div>
              ) : noChecklist || checklistItems.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center space-y-3">
                  <ClipboardCheck className="h-10 w-10 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">
                    No move-in checklist has been configured for your unit.
                    You can skip this step.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(checklistByArea).map(([area, items]) => (
                    <div key={area} className="space-y-2">
                      <h3 className="text-sm font-semibold text-foreground border-b border-border pb-1">
                        {area}
                      </h3>
                      {items.map(({ item, idx }) => (
                        <div
                          key={idx}
                          className={`rounded-lg border p-3 space-y-2 transition-colors ${
                            item.acknowledged
                              ? "border-emerald-500/30 bg-emerald-500/5"
                              : "border-border"
                          }`}
                        >
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={item.acknowledged}
                              onChange={() => toggleChecklistItem(idx)}
                              className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                            />
                            <div className="flex-1">
                              <span className="text-sm font-medium">
                                {item.item}
                              </span>
                              <span className="ml-2 text-xs text-muted-foreground">
                                ({item.condition})
                              </span>
                            </div>
                          </label>
                          <Input
                            placeholder="Notes (optional) — e.g. scratch on wall"
                            value={item.notes}
                            onChange={(e) =>
                              updateChecklistNotes(idx, e.target.value)
                            }
                            className="text-xs h-8"
                          />
                        </div>
                      ))}
                    </div>
                  ))}

                  <div className="text-xs text-muted-foreground text-center pt-2">
                    {checklistItems.filter((i) => i.acknowledged).length} of{" "}
                    {checklistItems.length} items acknowledged
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setStep(3)}
                  className="flex-1"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                {noChecklist || checklistItems.length === 0 ? (
                  <Button onClick={skipChecklist} className="flex-1">
                    Skip — Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={saveChecklist}
                    disabled={loading || !allAcknowledged}
                    className="flex-1"
                  >
                    {loading ? "Saving..." : allAcknowledged ? "Save & Continue" : "Acknowledge All Items"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 5: Documents ── */}
        {step === 5 && (
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Upload Documents</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Upload a copy of your photo ID and proof of renter&apos;s
                insurance. These are optional but may be required by your
                property manager.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {docsLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading...
                </div>
              ) : (
                <>
                  {/* ID Upload */}
                  <div className="rounded-lg border border-border p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Photo ID</span>
                      <span className="text-xs text-muted-foreground">(optional)</span>
                    </div>
                    {documents.filter((d) => d.type === "ID").length > 0 ? (
                      documents
                        .filter((d) => d.type === "ID")
                        .map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between rounded border border-emerald-500/30 bg-emerald-500/5 px-3 py-2"
                          >
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              <span className="text-sm">{doc.name}</span>
                            </div>
                            {!doc.verifiedAt && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-destructive"
                                onClick={() => deleteDocument(doc.id)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        ))
                    ) : (
                      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border p-4 hover:bg-muted/50 transition-colors">
                        <Upload className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {uploading ? "Uploading..." : "Click to upload"}
                        </span>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*,.pdf"
                          onChange={(e) => handleFileSelect(e, "ID")}
                          disabled={uploading}
                        />
                      </label>
                    )}
                  </div>

                  {/* Insurance Upload */}
                  <div className="rounded-lg border border-border p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        Renter&apos;s Insurance
                      </span>
                      <span className="text-xs text-muted-foreground">(optional)</span>
                    </div>
                    {documents.filter((d) => d.type === "RENTERS_INSURANCE").length > 0 ? (
                      documents
                        .filter((d) => d.type === "RENTERS_INSURANCE")
                        .map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between rounded border border-emerald-500/30 bg-emerald-500/5 px-3 py-2"
                          >
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              <span className="text-sm">{doc.name}</span>
                            </div>
                            {!doc.verifiedAt && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-destructive"
                                onClick={() => deleteDocument(doc.id)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        ))
                    ) : (
                      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border p-4 hover:bg-muted/50 transition-colors">
                        <Upload className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {uploading ? "Uploading..." : "Click to upload"}
                        </span>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*,.pdf"
                          onChange={(e) => handleFileSelect(e, "RENTERS_INSURANCE")}
                          disabled={uploading}
                        />
                      </label>
                    )}
                  </div>

                  {/* Other Documents */}
                  <div className="rounded-lg border border-border p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <FileUp className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Other Documents</span>
                      <span className="text-xs text-muted-foreground">(optional)</span>
                    </div>
                    {documents
                      .filter((d) => d.type === "OTHER")
                      .map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between rounded border border-border px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            <span className="text-sm">{doc.name}</span>
                          </div>
                          {!doc.verifiedAt && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-destructive"
                              onClick={() => deleteDocument(doc.id)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      ))}
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border p-3 hover:bg-muted/50 transition-colors">
                      <Plus className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {uploading ? "Uploading..." : "Upload additional document"}
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,.pdf,.doc,.docx"
                        onChange={(e) => handleFileSelect(e, "OTHER")}
                        disabled={uploading}
                      />
                    </label>
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setStep(4)}
                  className="flex-1"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={goToStep6} className="flex-1">
                  {documents.length > 0 ? "Continue" : "Skip — Continue"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 6: Lease Review ── */}
        {step === 6 && (
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Lease Review</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Review your lease terms and acknowledge that you&apos;ve read
                and understood the agreement.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {leaseLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading lease...
                </div>
              ) : !leaseInfo || !leaseInfo.lease ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center space-y-3">
                  <FileText className="h-10 w-10 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">
                    No lease has been uploaded for your unit yet. You can skip
                    this step and review it later.
                  </p>
                </div>
              ) : leaseAcked ? (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-center space-y-2">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                  <p className="text-sm font-medium">
                    Lease acknowledged!
                  </p>
                </div>
              ) : (
                <>
                  <div className="rounded-lg border border-border divide-y divide-border">
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-muted-foreground">Property</span>
                      <span className="text-sm font-medium">{leaseInfo.property}</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-muted-foreground">Unit</span>
                      <span className="text-sm font-medium">{leaseInfo.unit}</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-muted-foreground">Lease Start</span>
                      <span className="text-sm font-medium">
                        {new Date(leaseInfo.lease.startDate).toLocaleDateString()}
                      </span>
                    </div>
                    {leaseInfo.lease.endDate && (
                      <div className="flex items-center justify-between px-4 py-3">
                        <span className="text-sm text-muted-foreground">Lease End</span>
                        <span className="text-sm font-medium">
                          {new Date(leaseInfo.lease.endDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-muted-foreground">Monthly Rent</span>
                      <span className="text-sm font-medium">
                        {formatMoney(leaseInfo.lease.rentAmount)}
                      </span>
                    </div>
                    {leaseInfo.lease.securityDeposit != null && (
                      <div className="flex items-center justify-between px-4 py-3">
                        <span className="text-sm text-muted-foreground">Security Deposit</span>
                        <span className="text-sm font-medium">
                          {formatMoney(leaseInfo.lease.securityDeposit)}
                        </span>
                      </div>
                    )}
                  </div>

                  {leaseInfo.lease.terms && (
                    <div className="rounded-lg border border-border p-4">
                      <h4 className="text-sm font-medium mb-2">Lease Terms</h4>
                      <div className="max-h-48 overflow-y-auto text-xs text-muted-foreground whitespace-pre-wrap">
                        {leaseInfo.lease.terms}
                      </div>
                    </div>
                  )}

                  <label className="flex items-start gap-3 rounded-lg border border-border p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                    <input
                      type="checkbox"
                      id="leaseAck"
                      className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                      onChange={(e) => {
                        if (e.target.checked) {
                          acknowledgeLease();
                        }
                      }}
                    />
                    <span className="text-sm">
                      I acknowledge that I have read and understood the lease
                      terms for this unit.
                    </span>
                  </label>
                </>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setStep(5)}
                  className="flex-1"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                {(!leaseInfo || !leaseInfo.lease) && (
                  <Button onClick={skipLease} className="flex-1">
                    Skip — Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
                {leaseAcked && (
                  <Button onClick={() => { updateOnboardingStep("COMPLETE"); setStep(7); }} className="flex-1">
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 7: Complete ── */}
        {step === 7 && (
          <Card className="border-border">
            <CardHeader className="text-center">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Rocket className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>You&apos;re All Set!</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Your DoorStax tenant portal is ready. Here&apos;s a summary of
                your setup:
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border divide-y divide-border">
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm">Property</span>
                  <span className="text-sm font-medium">
                    {data.property} — Unit {data.unit}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm">Monthly Rent</span>
                  <span className="text-sm font-medium">
                    {formatMoney(data.rentAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm">Payment Method</span>
                  <span
                    className={`text-sm font-medium ${
                      paymentSaved ? "text-emerald-600" : "text-amber-500"
                    }`}
                  >
                    {paymentSaved ? "Stored" : "Skipped"}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm">Roommates</span>
                  <span
                    className={`text-sm font-medium ${
                      roommatesSubmitted ? "text-amber-500" : "text-muted-foreground"
                    }`}
                  >
                    {roommatesSubmitted
                      ? `${roommates.length} pending PM approval`
                      : "None"}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm">Move-In Checklist</span>
                  <span
                    className={`text-sm font-medium ${
                      checklistItems.length > 0 && allAcknowledged
                        ? "text-emerald-600"
                        : "text-muted-foreground"
                    }`}
                  >
                    {checklistItems.length > 0 && allAcknowledged
                      ? "Completed"
                      : noChecklist || checklistItems.length === 0
                      ? "N/A"
                      : "Skipped"}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm">Documents</span>
                  <span
                    className={`text-sm font-medium ${
                      documents.length > 0
                        ? "text-emerald-600"
                        : "text-muted-foreground"
                    }`}
                  >
                    {documents.length > 0
                      ? `${documents.length} uploaded`
                      : "None"}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm">Lease</span>
                  <span
                    className={`text-sm font-medium ${
                      leaseAcked ? "text-emerald-600" : "text-muted-foreground"
                    }`}
                  >
                    {leaseAcked ? "Acknowledged" : "Not reviewed"}
                  </span>
                </div>
              </div>

              <Button
                onClick={completeOnboarding}
                disabled={loading}
                className="w-full gradient-bg text-white hover:opacity-90"
                size="lg"
              >
                {loading ? "Setting up..." : "Go to My Dashboard"}
                <Rocket className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

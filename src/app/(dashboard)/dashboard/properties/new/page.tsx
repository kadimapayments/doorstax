"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import {
  WizardShell,
  WizardFooter,
  type WizardStep,
} from "./_components/wizard-shell";
import { StepBasics } from "./_components/step-basics";
import { StepBuilding } from "./_components/step-building";
import { StepMix } from "./_components/step-mix";
import { StepOwner } from "./_components/step-owner";
import { StepDocuments } from "./_components/step-documents";
import { StepReview } from "./_components/step-review";
import {
  initialWizardState,
  loadDraft,
  saveDraft,
  clearDraft,
  buildSubmitPayload,
  type WizardState,
} from "./_lib/wizard-state";
import {
  propertyOnboardingStep1Schema,
  propertyOnboardingStep2Schema,
  propertyOnboardingStep3Schema,
  propertyOnboardingStep4Schema,
} from "@/lib/validations/property-onboarding";

const STEPS: WizardStep[] = [
  { id: 1, label: "Basics" },
  { id: 2, label: "Building" },
  { id: 3, label: "Units & mix", shortLabel: "Units" },
  { id: 4, label: "Owner" },
  { id: 5, label: "Documents", shortLabel: "Docs" },
  { id: 6, label: "Review" },
];

/**
 * /dashboard/properties/new — 6-step property onboarding wizard.
 *
 * Two-phase create: steps 1-4 are pure form state (never touches the DB),
 * but on Next from step 4 we POST the property so step 5 has a real
 * propertyId to attach documents to. If the PM then jumps back and edits
 * step 1-4, we PATCH on the way forward out of the edited step. Final
 * submit in step 6 does a last PATCH + redirects to the property detail
 * with the "Pending review" banner.
 */
export default function NewPropertyWizardPage() {
  const router = useRouter();
  const [state, setState] = useState<WizardState>(initialWizardState);
  const [current, setCurrent] = useState<number>(1);
  const [furthestReached, setFurthestReached] = useState<number>(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const hydrated = useRef(false);

  // Rehydrate sessionStorage draft on first mount.
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const draft = loadDraft();
    if (draft) setState(draft);
  }, []);

  // Persist every change.
  useEffect(() => {
    if (!hydrated.current) return;
    saveDraft(state);
  }, [state]);

  const update = useCallback((patch: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  // ── Validation ────────────────────────────────────
  const validateCurrent = useCallback((): boolean => {
    const baseErrors: Record<string, string> = {};
    let schema: {
      safeParse: (v: unknown) => {
        success: boolean;
        error?: { errors: { path: (string | number)[]; message: string }[] };
      };
    } | null = null;
    let input: unknown = null;

    switch (current) {
      case 1:
        schema = propertyOnboardingStep1Schema;
        input = {
          name: state.name,
          address: state.address,
          city: state.city,
          state: state.state,
          zip: state.zip,
          propertyType: state.propertyType,
          description: state.description || undefined,
          purchasePrice: state.purchasePrice || undefined,
          purchaseDate: state.purchaseDate || undefined,
          photos: state.photos,
        };
        break;
      case 2:
        // step2 requires booleans for elevator/laundry — coerce from null
        if (state.hasElevator === null) {
          baseErrors.hasElevator = "Select Yes or No";
        }
        if (state.hasOnsiteLaundry === null) {
          baseErrors.hasOnsiteLaundry = "Select Yes or No";
        }
        schema = propertyOnboardingStep2Schema;
        input = {
          yearBuilt: state.yearBuilt,
          totalSqft: state.totalSqft,
          storyCount: state.storyCount,
          hasElevator: state.hasElevator ?? false,
          constructionType: state.constructionType,
          parkingSpaces: state.parkingSpaces,
          parkingType: state.parkingType,
          hasOnsiteLaundry: state.hasOnsiteLaundry ?? false,
        };
        break;
      case 3:
        schema = propertyOnboardingStep3Schema;
        input = {
          residentialUnitCount: state.residentialUnitCount,
          commercialUnitCount: state.commercialUnitCount || "0",
          commercialFloors: state.commercialFloors || undefined,
          section8UnitCount: state.section8UnitCount || "0",
          zoning: state.zoning || undefined,
          parcelNumber: state.parcelNumber || undefined,
          annualPropertyTax: state.annualPropertyTax || undefined,
        };
        break;
      case 4:
        schema = propertyOnboardingStep4Schema;
        input = {
          ownerId: state.ownerId,
          expectedMonthlyRentRoll:
            state.expectedMonthlyRentRoll || undefined,
          mortgageHolder: state.mortgageHolder || undefined,
          insuranceCarrier: state.insuranceCarrier || undefined,
          insurancePolicyNumber: state.insurancePolicyNumber || undefined,
        };
        break;
      case 5:
        if (
          state.documents.length === 0 &&
          !state.acknowledgedNoDocuments
        ) {
          baseErrors.__docs =
            "Upload at least one document, or check the acknowledgement below.";
        }
        break;
      default:
        break;
    }

    if (schema && input !== null) {
      const result = schema.safeParse(input);
      if (!result.success && result.error) {
        for (const issue of result.error.errors) {
          const key = String(issue.path[0]);
          if (!baseErrors[key]) baseErrors[key] = issue.message;
        }
      }
    }

    setErrors(baseErrors);
    return Object.keys(baseErrors).length === 0;
  }, [current, state]);

  // ── Transitions ────────────────────────────────────

  // If no property has been created yet, POST /api/properties to get one.
  // Called on step 4 → 5 transition. Re-run after edits in step 1-4 via
  // PATCH /api/properties/[id].
  async function ensurePropertyPersisted(): Promise<string | null> {
    const payload = buildSubmitPayload(state);
    const url = state.createdPropertyId
      ? `/api/properties/${state.createdPropertyId}`
      : `/api/properties`;
    const method = state.createdPropertyId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(body.error || "Failed to save property");
      return null;
    }

    const id = body.id || state.createdPropertyId;
    if (id && !state.createdPropertyId) {
      update({ createdPropertyId: id });
    }
    return id || null;
  }

  async function handleNext() {
    if (!validateCurrent()) return;
    setLoading(true);
    try {
      // Entering step 5: we need a real propertyId to attach docs to.
      if (current === 4) {
        const id = await ensurePropertyPersisted();
        if (!id) return;
      }
      // Editing steps 1-4 AFTER the property exists: propagate edits back.
      if (
        current < 4 &&
        state.createdPropertyId
      ) {
        const id = await ensurePropertyPersisted();
        if (!id) return;
      }

      const nextStep = current + 1;
      setCurrent(nextStep);
      setFurthestReached((f) => Math.max(f, nextStep));
      setErrors({});
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    if (current > 1) {
      setCurrent(current - 1);
      setErrors({});
    }
  }

  function handleJumpTo(stepId: number) {
    if (stepId <= furthestReached) {
      setCurrent(stepId);
      setErrors({});
    }
  }

  async function handleSubmit() {
    if (!state.createdPropertyId) {
      toast.error("Property was not saved. Go back and retry.");
      return;
    }
    setLoading(true);
    try {
      // One last PATCH so any step-6 edits are captured.
      await ensurePropertyPersisted();
      clearDraft();
      toast.success("Submitted for underwriter review");
      router.push(
        `/dashboard/properties/${state.createdPropertyId}?pendingReview=1`
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Submit failed"
      );
    } finally {
      setLoading(false);
    }
  }

  const stepBody = useMemo(() => {
    switch (current) {
      case 1:
        return <StepBasics state={state} update={update} errors={errors} />;
      case 2:
        return <StepBuilding state={state} update={update} errors={errors} />;
      case 3:
        return <StepMix state={state} update={update} errors={errors} />;
      case 4:
        return <StepOwner state={state} update={update} errors={errors} />;
      case 5:
        return <StepDocuments state={state} update={update} />;
      case 6:
        return <StepReview state={state} />;
      default:
        return null;
    }
  }, [current, state, update, errors]);

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="Add Property"
        description="Six short steps — underwriters use this profile to clear payments on the new building."
      />

      <WizardShell
        steps={STEPS}
        current={current}
        furthestReached={furthestReached}
        onJumpTo={handleJumpTo}
      >
        <div className="space-y-4">
          {stepBody}

          {errors.__docs && (
            <p className="text-xs text-destructive">{errors.__docs}</p>
          )}

          <WizardFooter
            onBack={current === 1 ? () => router.back() : handleBack}
            backLabel={current === 1 ? "Cancel" : "Back"}
            onNext={handleNext}
            onSubmit={handleSubmit}
            loading={loading}
            isFinal={current === 6}
            nextLabel={current === 4 ? "Save & continue" : "Next"}
          />
        </div>
      </WizardShell>
    </div>
  );
}

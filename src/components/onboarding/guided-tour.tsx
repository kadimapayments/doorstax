"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { X, ChevronRight, Sparkles } from "lucide-react";
import type { OnboardingState } from "@/lib/onboarding";

// ─── Tour step definitions ──────────────────────────
interface TourStep {
  id: string;
  title: string;
  description: string;
  target: string | null; // data-tour-target value, null = centered modal
  milestone?: keyof Omit<OnboardingState, "complete" | "completedAt">;
  ctaLabel?: string;
  ctaHref?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to DoorStax!",
    description:
      "Let\u2019s get your account set up in a few easy steps. We\u2019ll guide you through adding your first property, setting up payments, and inviting a tenant.",
    target: null,
  },
  {
    id: "property",
    title: "Add Your First Property",
    description:
      "Start by creating a property with its address and details. You\u2019ll add units and tenants next.",
    target: "properties",
    milestone: "propertyAdded",
    ctaLabel: "Go to Properties",
    ctaHref: "/dashboard/properties",
  },
  {
    id: "merchant",
    title: "Set Up Payment Processing",
    description:
      "Complete your merchant application so you can collect rent payments online.",
    target: "onboarding",
    milestone: "merchantStarted",
    ctaLabel: "Start Application",
    ctaHref: "/dashboard/onboarding",
  },
  {
    id: "tenant",
    title: "Add Your First Tenant",
    description:
      "Create a tenant and assign them to one of your units. They\u2019ll be able to pay rent through the platform.",
    target: "tenants",
    milestone: "tenantAdded",
    ctaLabel: "Add a Tenant",
    ctaHref: "/dashboard/tenants",
  },
  {
    id: "invite",
    title: "Send a Tenant Invite",
    description:
      "Send an email invite so your tenant can create their account and set up autopay.",
    target: "tenants",
    milestone: "inviteSent",
    ctaLabel: "Go to Tenants",
    ctaHref: "/dashboard/tenants",
  },
];

// ─── LocalStorage persistence ────────────────────────
const STORAGE_KEY = "doorstax-guided-tour";

interface TourState {
  step: number;
  dismissed: boolean;
}

function loadTourState(): TourState {
  if (typeof window === "undefined") return { step: 0, dismissed: false };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { step: 0, dismissed: false };
    return JSON.parse(raw);
  } catch {
    return { step: 0, dismissed: false };
  }
}

function saveTourState(state: TourState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* noop */
  }
}

// ─── Tooltip position calculator ─────────────────────
interface TooltipPosition {
  top: number;
  left: number;
  arrowSide: "left" | "top" | "bottom" | "right";
}

function calculatePosition(targetRect: DOMRect): TooltipPosition {
  const TOOLTIP_WIDTH = 320;
  const TOOLTIP_HEIGHT = 200;
  const GAP = 12;

  // Position to the right of the target by default
  let top = targetRect.top + targetRect.height / 2 - TOOLTIP_HEIGHT / 2;
  let left = targetRect.right + GAP;
  let arrowSide: TooltipPosition["arrowSide"] = "left";

  // If tooltip would overflow right, position to the left
  if (left + TOOLTIP_WIDTH > window.innerWidth - 16) {
    left = targetRect.left - TOOLTIP_WIDTH - GAP;
    arrowSide = "right";
  }

  // If tooltip would overflow left, position below
  if (left < 16) {
    left = Math.max(16, targetRect.left + targetRect.width / 2 - TOOLTIP_WIDTH / 2);
    top = targetRect.bottom + GAP;
    arrowSide = "top";
  }

  // Clamp vertically
  top = Math.max(16, Math.min(top, window.innerHeight - TOOLTIP_HEIGHT - 16));

  return { top, left, arrowSide };
}

// ─── Main Component ──────────────────────────────────
interface GuidedTourProps {
  milestones: OnboardingState;
}

export function GuidedTour({ milestones }: GuidedTourProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [tourState, setTourState] = useState<TourState>({ step: 0, dismissed: true });
  const [mounted, setMounted] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Load state from localStorage on mount
  useEffect(() => {
    const saved = loadTourState();
    setTourState(saved);
    setMounted(true);
  }, []);

  // Auto-advance when milestone for current step is completed
  useEffect(() => {
    if (!mounted || tourState.dismissed) return;

    const currentStep = TOUR_STEPS[tourState.step];
    if (!currentStep?.milestone) return;

    const milestoneKey = currentStep.milestone;
    if (milestones[milestoneKey]) {
      // This milestone is complete, advance to next incomplete step
      const nextStep = findNextIncompleteStep(tourState.step + 1, milestones);
      if (nextStep !== null) {
        const next = { ...tourState, step: nextStep };
        setTourState(next);
        saveTourState(next);
      } else {
        // All done, dismiss tour
        const next = { ...tourState, dismissed: true };
        setTourState(next);
        saveTourState(next);
      }
    }
  }, [milestones, mounted, tourState]);

  // Find and track target element position
  useEffect(() => {
    if (!mounted || tourState.dismissed) return;

    const step = TOUR_STEPS[tourState.step];
    if (!step?.target) {
      setTargetRect(null);
      return;
    }

    function updateRect() {
      const el = document.querySelector(`[data-tour-target="${step!.target}"]`);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    }

    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [tourState.step, tourState.dismissed, mounted, pathname]);

  const handleNext = useCallback(() => {
    const nextStep = findNextIncompleteStep(tourState.step + 1, milestones);
    if (nextStep !== null) {
      const next = { ...tourState, step: nextStep };
      setTourState(next);
      saveTourState(next);
    } else {
      const next = { ...tourState, dismissed: true };
      setTourState(next);
      saveTourState(next);
    }
  }, [tourState, milestones]);

  const handleDismiss = useCallback(() => {
    const next = { ...tourState, dismissed: true };
    setTourState(next);
    saveTourState(next);
  }, [tourState]);

  const handleCta = useCallback(
    (href: string) => {
      router.push(href);
    },
    [router]
  );

  // Don't render if dismissed, not mounted, or onboarding complete
  if (!mounted || tourState.dismissed || milestones.complete) return null;

  const currentStep = TOUR_STEPS[tourState.step];
  if (!currentStep) return null;

  const isCentered = !currentStep.target || !targetRect;
  const position = targetRect ? calculatePosition(targetRect) : null;

  return (
    <>
      {/* Backdrop overlay */}
      <div className="fixed inset-0 z-[9998] bg-black/40 transition-opacity duration-300" />

      {/* Spotlight cutout for target element */}
      {targetRect && (
        <div
          className="fixed z-[9999] rounded-lg ring-4 ring-primary/50 transition-all duration-300"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.4)",
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className={`fixed z-[10000] w-80 rounded-xl border border-border bg-background p-5 shadow-2xl transition-all duration-300 ${
          isCentered
            ? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            : ""
        }`}
        style={
          !isCentered && position
            ? { top: position.top, left: position.left }
            : undefined
        }
      >
        {/* Step indicator */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === tourState.step
                    ? "w-6 bg-primary"
                    : i < tourState.step
                    ? "w-1.5 bg-primary/50"
                    : "w-1.5 bg-muted-foreground/20"
                }`}
              />
            ))}
          </div>
          <button
            onClick={handleDismiss}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Content */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1.5">
            {tourState.step === 0 && <Sparkles className="h-4 w-4 text-primary" />}
            <h3 className="text-sm font-semibold">{currentStep.title}</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {currentStep.description}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleDismiss}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip Tour
          </button>
          <div className="flex items-center gap-2">
            {currentStep.ctaHref && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCta(currentStep.ctaHref!)}
              >
                {currentStep.ctaLabel}
              </Button>
            )}
            <Button size="sm" onClick={handleNext}>
              {tourState.step === TOUR_STEPS.length - 1 ? "Finish" : "Next"}
              <ChevronRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Helpers ─────────────────────────────────────────

function findNextIncompleteStep(
  fromIndex: number,
  milestones: OnboardingState
): number | null {
  for (let i = fromIndex; i < TOUR_STEPS.length; i++) {
    const step = TOUR_STEPS[i];
    if (!step.milestone) continue;
    if (!milestones[step.milestone]) return i;
  }
  return null;
}

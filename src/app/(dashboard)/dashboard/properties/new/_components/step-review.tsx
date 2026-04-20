"use client";

import { FileText, MapPin, Building2, Users, Receipt } from "lucide-react";
import type { WizardState } from "../_lib/wizard-state";

interface StepReviewProps {
  state: WizardState;
}

function fmt(v: string | null | undefined, fallback = "—") {
  return v && v.toString().trim() ? String(v) : fallback;
}

function fmtYesNo(v: boolean | null) {
  if (v === true) return "Yes";
  if (v === false) return "No";
  return "—";
}

function fmtMoney(v: string) {
  if (!v.trim()) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function StepReview({ state }: StepReviewProps) {
  const totalUnits =
    Number(state.residentialUnitCount || 0) +
    Number(state.commercialUnitCount || 0);

  return (
    <div className="space-y-5 rounded-xl border bg-card p-6">
      <div>
        <h2 className="text-lg font-semibold">Review &amp; submit</h2>
        <p className="text-sm text-muted-foreground">
          A last look before this goes to the underwriter. You can jump back
          to any step via the progress bar above to make changes.
        </p>
      </div>

      <ReviewSection icon={<MapPin className="h-4 w-4" />} title="Basics">
        <ReviewRow k="Name" v={fmt(state.name)} />
        <ReviewRow
          k="Address"
          v={`${fmt(state.address)}, ${fmt(state.city)}, ${fmt(state.state)} ${fmt(state.zip)}`}
        />
        <ReviewRow k="Type" v={fmt(state.propertyType)} />
        {state.description && (
          <ReviewRow k="Description" v={state.description} />
        )}
        <ReviewRow k="Purchase price" v={fmtMoney(state.purchasePrice)} />
        <ReviewRow k="Purchase date" v={fmt(state.purchaseDate)} />
        <ReviewRow k="Exterior photos" v={`${state.photos.length} uploaded`} />
      </ReviewSection>

      <ReviewSection icon={<Building2 className="h-4 w-4" />} title="Building">
        <ReviewRow k="Year built" v={fmt(state.yearBuilt)} />
        <ReviewRow k="Total sqft" v={fmt(state.totalSqft)} />
        <ReviewRow k="Stories" v={fmt(state.storyCount)} />
        <ReviewRow k="Construction" v={fmt(state.constructionType)} />
        <ReviewRow k="Elevator" v={fmtYesNo(state.hasElevator)} />
        <ReviewRow k="On-site laundry" v={fmtYesNo(state.hasOnsiteLaundry)} />
        <ReviewRow k="Parking spaces" v={fmt(state.parkingSpaces)} />
        <ReviewRow k="Parking type" v={fmt(state.parkingType)} />
      </ReviewSection>

      <ReviewSection icon={<Users className="h-4 w-4" />} title="Unit mix">
        <ReviewRow k="Residential units" v={fmt(state.residentialUnitCount)} />
        <ReviewRow k="Commercial units" v={fmt(state.commercialUnitCount)} />
        {state.commercialFloors && (
          <ReviewRow k="Commercial floors" v={state.commercialFloors} />
        )}
        <ReviewRow
          k="Section 8 / subsidized"
          v={fmt(state.section8UnitCount, "0")}
        />
        <ReviewRow k="Total units" v={String(totalUnits)} />
        {state.zoning && <ReviewRow k="Zoning" v={state.zoning} />}
        {state.parcelNumber && (
          <ReviewRow k="Parcel #" v={state.parcelNumber} />
        )}
        <ReviewRow
          k="Annual property tax"
          v={fmtMoney(state.annualPropertyTax)}
        />
      </ReviewSection>

      <ReviewSection icon={<Receipt className="h-4 w-4" />} title="Owner & finance">
        <ReviewRow
          k="Owner"
          v={state.ownerId ? "Selected (see step 4)" : "Not selected"}
        />
        <ReviewRow
          k="Expected monthly rent roll"
          v={fmtMoney(state.expectedMonthlyRentRoll)}
        />
        <ReviewRow k="Mortgage / lien holder" v={fmt(state.mortgageHolder)} />
        <ReviewRow k="Insurance carrier" v={fmt(state.insuranceCarrier)} />
        <ReviewRow k="Policy #" v={fmt(state.insurancePolicyNumber)} />
      </ReviewSection>

      <ReviewSection icon={<FileText className="h-4 w-4" />} title="Documents">
        {state.documents.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No documents uploaded. Underwriter may request more info before
            approving.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {state.documents.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3"
              >
                <span className="text-muted-foreground">{d.type}</span>
                <span className="truncate">{d.fileName}</span>
              </li>
            ))}
          </ul>
        )}
      </ReviewSection>

      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
        <p className="font-medium">What happens next</p>
        <p className="text-xs text-muted-foreground mt-1">
          The property is saved immediately — you&apos;ll land on its detail
          page with a &ldquo;Pending review&rdquo; banner. DoorStax underwriting
          reviews the profile + any documents and approves, rejects, or asks
          for more info. Live card / ACH charges against this property are
          paused until approval (usually within one business day).
        </p>
      </div>
    </div>
  );
}

function ReviewSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-primary">{icon}</span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="grid gap-1">{children}</div>
    </div>
  );
}

function ReviewRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground flex-shrink-0">{k}</span>
      <span className="text-right break-words">{v}</span>
    </div>
  );
}

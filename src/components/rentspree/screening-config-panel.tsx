"use client";

interface ScreeningConfigProps {
  creditReport: boolean;
  criminal: boolean;
  eviction: boolean;
  application: boolean;
  payerType: string;
  onChange: (config: {
    creditReport: boolean;
    criminal: boolean;
    eviction: boolean;
    application: boolean;
    payerType: string;
  }) => void;
  disabled?: boolean;
  propertyState?: string;
}

export function ScreeningConfigPanel({
  creditReport,
  criminal,
  eviction,
  application,
  payerType,
  onChange,
  disabled = false,
  propertyState,
}: ScreeningConfigProps) {
  const isCriminalRestricted = propertyState === "NJ" || propertyState === "IL";
  const isEvictionRestricted = propertyState === "NY";

  function handleCreditReportChange(checked: boolean) {
    if (!checked) {
      onChange({
        creditReport: false,
        criminal: false,
        eviction: false,
        application: true,
        payerType,
      });
    } else {
      onChange({ creditReport: true, criminal, eviction, application, payerType });
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <label className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Credit Report</p>
            <p className="text-xs text-muted-foreground">TransUnion credit check</p>
          </div>
          <input
            type="checkbox"
            checked={creditReport}
            onChange={(e) => handleCreditReportChange(e.target.checked)}
            disabled={disabled}
            className="h-4 w-4 rounded border-input"
          />
        </label>

        <label
          className={
            "flex items-center justify-between" +
            (!creditReport || isCriminalRestricted ? " opacity-50" : "")
          }
        >
          <div>
            <p className="text-sm font-medium">Criminal Background</p>
            <p className="text-xs text-muted-foreground">
              {isCriminalRestricted
                ? `Not available in ${propertyState}`
                : "Requires credit report"}
            </p>
          </div>
          <input
            type="checkbox"
            checked={criminal && !isCriminalRestricted}
            onChange={(e) =>
              onChange({
                creditReport,
                criminal: e.target.checked,
                eviction,
                application,
                payerType,
              })
            }
            disabled={disabled || !creditReport || isCriminalRestricted}
            className="h-4 w-4 rounded border-input"
          />
        </label>

        <label
          className={
            "flex items-center justify-between" +
            (!creditReport || isEvictionRestricted ? " opacity-50" : "")
          }
        >
          <div>
            <p className="text-sm font-medium">Eviction History</p>
            <p className="text-xs text-muted-foreground">
              {isEvictionRestricted
                ? "Not available in NY"
                : "Requires credit report"}
            </p>
          </div>
          <input
            type="checkbox"
            checked={eviction && !isEvictionRestricted}
            onChange={(e) =>
              onChange({
                creditReport,
                criminal,
                eviction: e.target.checked,
                application,
                payerType,
              })
            }
            disabled={disabled || !creditReport || isEvictionRestricted}
            className="h-4 w-4 rounded border-input"
          />
        </label>

        <label className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Rental Application</p>
            <p className="text-xs text-muted-foreground">
              Income, employment, references
            </p>
          </div>
          <input
            type="checkbox"
            checked={application}
            onChange={(e) =>
              onChange({
                creditReport,
                criminal,
                eviction,
                application: e.target.checked,
                payerType,
              })
            }
            disabled={disabled || !creditReport}
            className="h-4 w-4 rounded border-input"
          />
        </label>
      </div>

      <div className="border-t pt-3">
        <p className="text-sm font-medium mb-2">Who pays for screening?</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              onChange({
                creditReport,
                criminal,
                eviction,
                application,
                payerType: "landlord",
              })
            }
            disabled={disabled}
            className={
              "rounded-lg px-3 py-1.5 text-sm font-medium border " +
              (payerType === "landlord"
                ? "bg-primary text-primary-foreground border-primary"
                : "hover:bg-muted")
            }
          >
            Landlord / PM
          </button>
          <button
            type="button"
            onClick={() =>
              onChange({
                creditReport,
                criminal,
                eviction,
                application,
                payerType: "renter",
              })
            }
            disabled={disabled}
            className={
              "rounded-lg px-3 py-1.5 text-sm font-medium border " +
              (payerType === "renter"
                ? "bg-primary text-primary-foreground border-primary"
                : "hover:bg-muted")
            }
          >
            Applicant
          </button>
        </div>
      </div>
    </div>
  );
}

import { requireRole } from "@/lib/auth-utils";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { ArrowRight, Upload, Building2, FileSpreadsheet, CheckCircle } from "lucide-react";

export const metadata = { title: "Switch to DoorStax" };

const SOURCES = [
  {
    name: "AppFolio",
    description: "Import properties, tenants, and lease data from AppFolio exports.",
    icon: Building2,
    color: "bg-blue-500/10 text-blue-600",
  },
  {
    name: "Yardi Breeze",
    description: "Migrate your Yardi Breeze portfolio with guided column mapping.",
    icon: Building2,
    color: "bg-purple-500/10 text-purple-600",
  },
  {
    name: "DoorLoop",
    description: "Transfer properties, units, and tenants from DoorLoop CSV exports.",
    icon: Building2,
    color: "bg-emerald-500/10 text-emerald-600",
  },
  {
    name: "Other / CSV",
    description: "Upload a custom CSV or Excel file with your property data.",
    icon: FileSpreadsheet,
    color: "bg-amber-500/10 text-amber-600",
  },
];

const STEPS = [
  { step: 1, title: "Select Source", description: "Choose your current property management platform." },
  { step: 2, title: "Export Data", description: "Download your data from the current platform using our guides." },
  { step: 3, title: "Upload & Map", description: "Upload your file and map columns to DoorStax fields." },
  { step: 4, title: "Review & Import", description: "Preview the data and confirm the import." },
];

export default async function MigratePage() {
  await requireRole("PM");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Switch to DoorStax"
        description="Seamlessly migrate your property portfolio from another platform. Easy data transfer in minutes."
      />

      {/* How It Works */}
      <div className="rounded-lg border border-border p-6">
        <h2 className="text-lg font-semibold mb-4">How It Works</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.step} className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                {s.step}
              </div>
              <div>
                <p className="font-medium text-sm">{s.title}</p>
                <p className="text-xs text-muted-foreground">{s.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Source Selection */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Choose Your Platform</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {SOURCES.map((source) => (
            <div
              key={source.name}
              className="rounded-lg border border-border p-5 hover:border-border/80 transition-colors card-glow"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`rounded-lg p-2 ${source.color}`}>
                  <source.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold">{source.name}</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">{source.description}</p>
              <div className="flex gap-2">
                <Link href="/dashboard/properties/migrate">
                  <Button size="sm">
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    Import Properties
                  </Button>
                </Link>
                <Link href="/dashboard/tenants/migrate">
                  <Button size="sm" variant="outline">
                    Import Tenants
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* What Gets Migrated */}
      <div className="rounded-lg border border-border p-6">
        <h2 className="text-lg font-semibold mb-4">What Gets Migrated</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            "Properties & Units",
            "Tenant Information",
            "Lease Agreements",
            "Rent Amounts & Due Dates",
            "Contact Details",
            "Unit Details (Beds/Baths/Sqft)",
          ].map((item) => (
            <div key={item} className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
              {item}
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Payment history and financial data can be imported separately after initial setup.
        </p>
      </div>
    </div>
  );
}

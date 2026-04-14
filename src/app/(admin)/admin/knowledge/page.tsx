export const dynamic = "force-dynamic";

import { requireAdminPermission } from "@/lib/auth-utils";
import { Building2, Users, ShieldCheck } from "lucide-react";

export const metadata = { title: "Knowledge Base — Admin" };

export default async function KnowledgeBasePage() {
  await requireAdminPermission("admin:overview");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Knowledge Base</h1>
        <p className="text-sm text-muted-foreground">
          Help documentation for all DoorStax users
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <a
          href="/knowledge/pm"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border bg-card p-6 hover:border-primary/50 transition-colors group"
        >
          <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
            <Building2 className="h-6 w-6 text-blue-600" />
          </div>
          <h3 className="text-base font-semibold group-hover:text-primary">
            Property Manager Guide
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            How to set up properties, manage tenants, process payments, and
            use all PM features.
          </p>
          <span className="text-xs text-primary mt-3 inline-block">
            Open guide &rarr;
          </span>
        </a>

        <a
          href="/knowledge/tenant"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border bg-card p-6 hover:border-primary/50 transition-colors group"
        >
          <div className="h-12 w-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
            <Users className="h-6 w-6 text-green-600" />
          </div>
          <h3 className="text-base font-semibold group-hover:text-primary">
            Tenant Guide
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            How to pay rent, manage payment methods, view receipts, and use
            the tenant portal.
          </p>
          <span className="text-xs text-primary mt-3 inline-block">
            Open guide &rarr;
          </span>
        </a>

        <a
          href="/knowledge/admin"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border bg-card p-6 hover:border-primary/50 transition-colors group"
        >
          <div className="h-12 w-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-4">
            <ShieldCheck className="h-6 w-6 text-purple-600" />
          </div>
          <h3 className="text-base font-semibold group-hover:text-primary">
            Admin Guide
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Platform administration, merchant management, agent network, and
            system configuration.
          </p>
          <span className="text-xs text-primary mt-3 inline-block">
            Open guide &rarr;
          </span>
        </a>
      </div>

      <div className="rounded-xl border bg-muted/30 p-4">
        <p className="text-sm text-muted-foreground">
          Knowledge base content is managed separately. Contact the
          development team to add or update articles.
        </p>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { Plus, FileText } from "lucide-react";

interface Template {
  id: string;
  name: string;
  description: string | null;
  fields: { name: string; label: string; type: string; required: boolean }[];
  isDefault: boolean;
  _count: { units: number };
  createdAt: string;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    fetch("/api/applications/templates")
      .then((r) => r.json())
      .then((data) => setTemplates(Array.isArray(data) ? data : []));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Application Templates"
        description="Create custom rental application forms for your properties."
        actions={
          <Link href="/dashboard/applications/templates/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Template
            </Button>
          </Link>
        }
      />

      {templates.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-12 w-12" />}
          title="No templates yet"
          description="Create a custom application template to collect exactly the information you need from tenants."
          action={
            <Link href="/dashboard/applications/templates/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Template
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Link
              key={t.id}
              href={`/dashboard/applications/templates/${t.id}`}
              className="block"
            >
              <Card className="border-border hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold">{t.name}</h3>
                    {t.isDefault && <StatusBadge status="ACTIVE" />}
                  </div>
                  {t.description && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {t.description}
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{t.fields.length} fields</span>
                    <span>&middot; {t._count.units} unit{t._count.units !== 1 ? "s" : ""} using</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

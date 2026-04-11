"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Plus, FileText, Star } from "lucide-react";
import { toast } from "sonner";

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
  const [settingDefault, setSettingDefault] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/applications/templates")
      .then((r) => r.json())
      .then((data) => setTemplates(Array.isArray(data) ? data : []));
  }, []);

  async function handleSetDefault(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    setSettingDefault(id);
    try {
      const res = await fetch(
        `/api/applications/templates/${id}/set-default`,
        { method: "POST" }
      );
      if (res.ok) {
        setTemplates((prev) =>
          prev.map((t) => ({ ...t, isDefault: t.id === id }))
        );
        toast.success("Default template updated");
      } else {
        toast.error("Failed to set default");
      }
    } catch {
      toast.error("Failed to set default");
    } finally {
      setSettingDefault(null);
    }
  }

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
              <Card
                className={
                  "hover:shadow-sm transition-all cursor-pointer " +
                  (t.isDefault
                    ? "border-primary/40 ring-1 ring-primary/20"
                    : "border-border hover:border-primary/30")
                }
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold">{t.name}</h3>
                    {t.isDefault && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary border border-primary/20">
                        <Star className="h-3 w-3 fill-current" />
                        Default
                      </span>
                    )}
                  </div>
                  {t.description && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {t.description}
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{t.fields.length} fields</span>
                    <span>
                      &middot; {t._count.units} unit
                      {t._count.units !== 1 ? "s" : ""} using
                    </span>
                  </div>
                  {!t.isDefault && (
                    <div className="mt-4 pt-3 border-t border-border">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-7 text-xs"
                        disabled={settingDefault === t.id}
                        onClick={(e) => handleSetDefault(e, t.id)}
                      >
                        <Star className="h-3 w-3 mr-1" />
                        {settingDefault === t.id
                          ? "Setting..."
                          : "Set as Default"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

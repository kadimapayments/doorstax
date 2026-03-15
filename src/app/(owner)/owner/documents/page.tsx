"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { Download, FileText, FolderOpen } from "lucide-react";

interface OwnerDoc {
  id: string;
  name: string;
  url: string;
  type: string;
  period: string | null;
  createdAt: string;
}

const typeBadge: Record<string, string> = {
  STATEMENT: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  TAX_DOC: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
  AGREEMENT: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  OTHER: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export default function OwnerDocumentsPage() {
  const [documents, setDocuments] = useState<OwnerDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/owner/documents")
      .then((r) => r.json())
      .then(setDocuments)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
        <p className="text-muted-foreground">
          Access your owner documents, statements, and agreements.
        </p>
      </div>

      {documents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FolderOpen className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-lg font-medium">No documents yet</p>
            <p className="text-sm text-muted-foreground">
              Documents shared with you will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">All Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{doc.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatDate(doc.createdAt)}</span>
                        {doc.period && <span>| {doc.period}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        typeBadge[doc.type] ?? typeBadge.OTHER
                      }`}
                    >
                      {doc.type.replace("_", " ")}
                    </span>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

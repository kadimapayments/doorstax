"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * Segment-level error boundary for the PM /dashboard route.
 *
 * Renders a friendly card. In addition — and this is the whole point of
 * shipping this file as a temporary instrumentation — it also renders a
 * collapsible <details> block with `error.message` and `error.digest` so
 * we can see exactly what's crashing the page on sandbox without having
 * to crawl Vercel runtime logs.
 *
 * Once the underlying bug is fixed we can either delete this file (Next
 * falls back to the global error.tsx) or tighten it up into production
 * copy.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Also log to the browser console so it's pasteable from DevTools.
    // eslint-disable-next-line no-console
    console.error("[dashboard/error.tsx]", {
      name: error?.name,
      message: error?.message,
      digest: error?.digest,
      stack: error?.stack,
    });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 text-center space-y-4 animate-fade-scale-in">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
          <AlertTriangle className="h-6 w-6 text-red-500" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Dashboard failed to load</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Something went wrong rendering your dashboard. The error below is
            what we need to fix it.
          </p>
        </div>

        <details className="text-left rounded-lg border bg-muted/30 p-3 text-xs">
          <summary className="cursor-pointer font-mono font-medium select-none">
            Show error details (copy + paste this)
          </summary>
          <div className="mt-3 space-y-2">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Name
              </p>
              <pre className="whitespace-pre-wrap break-words font-mono text-[11px]">
                {error?.name || "—"}
              </pre>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Message
              </p>
              <pre className="whitespace-pre-wrap break-words font-mono text-[11px]">
                {error?.message || "—"}
              </pre>
            </div>
            {error?.digest && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  Digest
                </p>
                <pre className="whitespace-pre-wrap break-words font-mono text-[11px]">
                  {error.digest}
                </pre>
              </div>
            )}
            {error?.stack && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  Stack
                </p>
                <pre className="whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed max-h-64 overflow-auto">
                  {error.stack}
                </pre>
              </div>
            )}
          </div>
        </details>

        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => reset()}
            className="btn-press rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
          <a
            href="/admin"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Go to admin
          </a>
        </div>
      </div>
    </div>
  );
}

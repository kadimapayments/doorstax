import { ReactNode } from "react";

/**
 * TEMPORARY diagnostic wrapper for server components inside the PM dashboard.
 *
 * Next.js scrubs thrown server-component errors in production. By wrapping
 * suspect server components with this and passing an async render function,
 * we can catch any throw and render the real error inline instead — which
 * bypasses Next's scrubbing.
 *
 * Usage:
 *   <SafeServerBoundary label="TopLatePayers">
 *     {async () => <TopLatePayers landlordId={x} />}
 *   </SafeServerBoundary>
 *
 * Once we've fixed the sandbox dashboard crash we should delete this file
 * and restore direct rendering.
 */
export async function SafeServerBoundary({
  label,
  render,
}: {
  label: string;
  render: () => Promise<ReactNode>;
}) {
  try {
    return await render();
  } catch (e) {
    const err = e as Error;
    // Log for Vercel Function Logs grep.
    console.error(`[SafeServerBoundary:${label}] failed:`, err);
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-xs">
        <p className="font-semibold text-red-600 mb-1">
          Widget failed: {label}
        </p>
        <p className="font-mono whitespace-pre-wrap break-words">
          {err?.name}: {err?.message}
        </p>
        {err?.stack && (
          <details className="mt-2">
            <summary className="cursor-pointer text-muted-foreground">
              Stack
            </summary>
            <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[10px] max-h-64 overflow-auto leading-relaxed">
              {err.stack}
            </pre>
          </details>
        )}
      </div>
    );
  }
}

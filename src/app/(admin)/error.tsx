"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-lg space-y-4 text-center">
        <h2 className="text-2xl font-bold text-red-600">Admin Error</h2>
        <p className="text-sm text-muted-foreground">
          {error.message || "An unexpected error occurred"}
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground">Digest: {error.digest}</p>
        )}
        <pre className="mt-4 rounded bg-muted p-4 text-left text-xs overflow-auto max-h-64">
          {error.stack || "No stack trace available"}
        </pre>
        <button
          onClick={reset}
          className="mt-4 rounded bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

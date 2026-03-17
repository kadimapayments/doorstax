"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error for debugging
    console.error("[GlobalError]", error.message, error.stack);

    // Report to Sentry if available
    try {
      const Sentry = require("@sentry/nextjs");
      if (Sentry?.captureException) {
        Sentry.captureException(error);
      }
    } catch {
      // Sentry not available — ignore
    }
  }, [error]);

  return (
    <html>
      <body
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          fontFamily: "system-ui, sans-serif",
          backgroundColor: "#0a0a0a",
          color: "#fafafa",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: "400px", padding: "2rem" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.5rem" }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: "0.875rem", color: "#a1a1aa", marginBottom: "1.5rem" }}>
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={reset}
            style={{
              padding: "0.5rem 1.5rem",
              borderRadius: "0.5rem",
              border: "1px solid #27272a",
              backgroundColor: "#18181b",
              color: "#fafafa",
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}

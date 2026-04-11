"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error("[AdminError]", error.message, error.stack);
    }
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <Card className="max-w-lg w-full border-border">
        <CardContent className="p-8 text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold">Something went wrong</h2>
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred in the admin console. Try again, and
            contact support if the problem persists.
          </p>
          {error.digest && (
            <p className="text-[11px] text-muted-foreground font-mono">
              Ref: {error.digest}
            </p>
          )}
          {process.env.NODE_ENV === "development" && error.stack && (
            <pre className="mt-4 rounded bg-muted p-4 text-left text-xs overflow-auto max-h-64">
              {error.stack}
            </pre>
          )}
          <div className="flex justify-center gap-2 pt-2">
            <Button onClick={reset}>Try Again</Button>
            <Button
              variant="outline"
              onClick={() => (window.location.href = "/admin")}
            >
              Go to Admin
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

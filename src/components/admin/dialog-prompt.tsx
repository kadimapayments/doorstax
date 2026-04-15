"use client";

/**
 * Imperative dialog helpers — drop-in replacements for window.prompt and window.confirm.
 *
 * Usage:
 *   import { showPrompt, showConfirm } from "@/components/admin/dialog-prompt";
 *
 *   // Replace: const v = prompt("Enter value:");
 *   const v = await showPrompt({ title: "Enter Value", label: "Value" });
 *
 *   // Replace: if (confirm("Delete?")) { ... }
 *   if (await showConfirm({ title: "Delete?", description: "This cannot be undone." })) {
 *     ...
 *   }
 *
 * Requires <DialogPromptHost /> to be mounted once in the app layout.
 */

import { useEffect, useState } from "react";
import { AdminDialog } from "./admin-dialog";

type PromptOptions = {
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  type?: string;
  submitLabel?: string;
  instructions?: string;
  destructive?: boolean;
  multiline?: boolean;
  requireConfirmWord?: string;
};

type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
};

type PromptRequest = {
  kind: "prompt";
  opts: PromptOptions;
  resolve: (value: string | null) => void;
};
type ConfirmRequest = {
  kind: "confirm";
  opts: ConfirmOptions;
  resolve: (value: boolean) => void;
};

type Request = PromptRequest | ConfirmRequest;

// Module-scoped queue + subscriber
let subscriber: ((req: Request) => void) | null = null;
const queue: Request[] = [];

function enqueue(req: Request) {
  if (subscriber) subscriber(req);
  else queue.push(req);
}

export function showPrompt(opts: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => {
    enqueue({ kind: "prompt", opts, resolve });
  });
}

export function showConfirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    enqueue({ kind: "confirm", opts, resolve });
  });
}

/**
 * Mount this once near the root of the admin/dashboard layout.
 */
export function DialogPromptHost() {
  const [current, setCurrent] = useState<Request | null>(null);
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    subscriber = (req) => {
      setCurrent((prev) => {
        // If something is already open, queue it
        if (prev) {
          queue.push(req);
          return prev;
        }
        return req;
      });
    };
    // Flush any pre-mount requests
    while (queue.length > 0) {
      const req = queue.shift()!;
      setCurrent((prev) => (prev ? (queue.push(req), prev) : req));
    }
    return () => {
      subscriber = null;
    };
  }, []);

  // Reset input when dialog changes
  useEffect(() => {
    if (current?.kind === "prompt") {
      setValue(current.opts.defaultValue || "");
    }
  }, [current]);

  function closeCurrent(result: string | null | boolean) {
    if (!current) return;
    if (current.kind === "prompt") {
      (current as PromptRequest).resolve(result as string | null);
    } else {
      (current as ConfirmRequest).resolve(result as boolean);
    }
    // Pull next from queue
    setCurrent(queue.length > 0 ? queue.shift()! : null);
    setValue("");
    setSubmitting(false);
  }

  if (!current) return null;

  if (current.kind === "confirm") {
    const opts = current.opts;
    return (
      <AdminDialog open onClose={() => closeCurrent(false)} title={opts.title}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{opts.description}</p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => closeCurrent(false)}
              className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                setSubmitting(true);
                closeCurrent(true);
              }}
              disabled={submitting}
              className={
                "rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 " +
                (opts.destructive
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-primary hover:bg-primary/90")
              }
            >
              {opts.confirmLabel || "Confirm"}
            </button>
          </div>
        </div>
      </AdminDialog>
    );
  }

  const opts = current.opts;
  const confirmMismatch =
    !!opts.requireConfirmWord &&
    value.trim().length > 0 &&
    value.trim() !== opts.requireConfirmWord;

  function submitPrompt() {
    if (!value.trim()) return;
    if (opts.requireConfirmWord && value.trim() !== opts.requireConfirmWord) return;
    closeCurrent(value);
  }

  return (
    <AdminDialog
      open
      onClose={() => closeCurrent(null)}
      title={opts.title}
      description={opts.description}
    >
      <div className="space-y-4">
        {opts.instructions && (
          <div className="rounded-lg bg-muted/50 border p-3">
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">
              {opts.instructions}
            </p>
          </div>
        )}
        <div>
          {opts.label && <label className="text-sm font-medium">{opts.label}</label>}
          {opts.multiline ? (
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={opts.placeholder}
              rows={4}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
          ) : (
            <input
              type={opts.type || "text"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={opts.placeholder}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") submitPrompt();
              }}
            />
          )}
          {confirmMismatch && (
            <p className="text-xs text-red-500 mt-1">
              Must type exactly: {opts.requireConfirmWord}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => closeCurrent(null)}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={submitPrompt}
            disabled={
              !value.trim() ||
              submitting ||
              (!!opts.requireConfirmWord && value.trim() !== opts.requireConfirmWord)
            }
            className={
              "rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 " +
              (opts.destructive
                ? "bg-red-600 hover:bg-red-700"
                : "bg-primary hover:bg-primary/90")
            }
          >
            {opts.submitLabel || "Submit"}
          </button>
        </div>
      </div>
    </AdminDialog>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";

interface AdminDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export function AdminDialog({
  open,
  onClose,
  title,
  description,
  children,
  maxWidth = "max-w-md",
}: AdminDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    >
      <div
        className={
          "relative w-full rounded-xl border bg-card p-6 shadow-xl animate-fade-scale-in " +
          maxWidth
        }
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <h3 className="text-lg font-semibold pr-8">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

// ─── Input Dialog ──────────────────────────────────────────

interface InputDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void | Promise<void>;
  title: string;
  description?: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  type?: string;
  submitLabel?: string;
  instructions?: string;
  destructive?: boolean;
  multiline?: boolean;
  requireConfirmWord?: string;
}

export function InputDialog({
  open,
  onClose,
  onSubmit,
  title,
  description,
  label,
  placeholder,
  defaultValue,
  type,
  submitLabel,
  instructions,
  destructive,
  multiline,
  requireConfirmWord,
}: InputDialogProps) {
  const [value, setValue] = useState(defaultValue || "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setValue(defaultValue || "");
  }, [open, defaultValue]);

  async function handleSubmit() {
    if (!value.trim()) return;
    if (requireConfirmWord && value.trim() !== requireConfirmWord) return;
    setSubmitting(true);
    try {
      await onSubmit(value);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  const confirmMismatch =
    !!requireConfirmWord && value.trim().length > 0 && value.trim() !== requireConfirmWord;

  return (
    <AdminDialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
    >
      <div className="space-y-4">
        {instructions && (
          <div className="rounded-lg bg-muted/50 border p-3">
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">
              {instructions}
            </p>
          </div>
        )}
        <div>
          <label className="text-sm font-medium">{label}</label>
          {multiline ? (
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              rows={4}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
          ) : (
            <input
              type={type || "text"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
            />
          )}
          {confirmMismatch && (
            <p className="text-xs text-red-500 mt-1">
              Must type exactly: {requireConfirmWord}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              !value.trim() ||
              submitting ||
              (!!requireConfirmWord && value.trim() !== requireConfirmWord)
            }
            className={
              "rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 " +
              (destructive
                ? "bg-red-600 hover:bg-red-700"
                : "bg-primary hover:bg-primary/90")
            }
          >
            {submitting ? "Saving..." : submitLabel || "Save"}
          </button>
        </div>
      </div>
    </AdminDialog>
  );
}

// ─── Confirm Dialog ────────────────────────────────────────

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  destructive,
}: ConfirmDialogProps) {
  const [confirming, setConfirming] = useState(false);

  async function handleConfirm() {
    setConfirming(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setConfirming(false);
    }
  }

  return (
    <AdminDialog open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className={
              "rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 " +
              (destructive
                ? "bg-red-600 hover:bg-red-700"
                : "bg-primary hover:bg-primary/90")
            }
          >
            {confirming ? "Processing..." : confirmLabel || "Confirm"}
          </button>
        </div>
      </div>
    </AdminDialog>
  );
}

// ─── Select Dialog (for dropdown prompts like "payment method") ──

interface SelectDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void | Promise<void>;
  title: string;
  description?: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  submitLabel?: string;
}

export function SelectDialog({
  open,
  onClose,
  onSubmit,
  title,
  description,
  label,
  options,
  defaultValue,
  submitLabel,
}: SelectDialogProps) {
  const [value, setValue] = useState(defaultValue || options[0]?.value || "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setValue(defaultValue || options[0]?.value || "");
  }, [open, defaultValue, options]);

  async function handleSubmit() {
    if (!value) return;
    setSubmitting(true);
    try {
      await onSubmit(value);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminDialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
    >
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">{label}</label>
          <select
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!value || submitting}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? "Processing..." : submitLabel || "Submit"}
          </button>
        </div>
      </div>
    </AdminDialog>
  );
}

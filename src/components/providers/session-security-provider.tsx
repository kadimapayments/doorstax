"use client";

import React, { useEffect, useRef, useState, useCallback, Component } from "react";
import { signOut, useSession } from "next-auth/react";
import { LockScreen, SessionWarningOverlay } from "./lock-screen";
import {
  SESSION_LOCK_MS,
  SESSION_LOCK_WARNING_MS,
  SESSION_HARD_LOGOUT_MS,
  SESSION_MAX_LIFETIME_MS,
  SESSION_CHECK_INTERVAL_MS,
  STORAGE_KEY_LAST_ACTIVITY,
  STORAGE_KEY_SESSION_LOCKED,
  STORAGE_KEY_SESSION_START,
} from "@/lib/constants";

type SessionState = "active" | "warning" | "locked";

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keypress",
  "touchstart",
  "scroll",
] as const;

/* ── Error Boundary ─────────────────────────────────────────── */

interface ErrorBoundaryState {
  hasError: boolean;
}

class SessionSecurityErrorBoundary extends Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("[SessionSecurity] Error caught by boundary:", error);
  }

  render() {
    if (this.state.hasError) {
      // Degrade gracefully — render children without session security
      return <>{this.props.children}</>;
    }
    return this.props.children;
  }
}

/* ── Main Provider ──────────────────────────────────────────── */

export function SessionSecurityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionSecurityErrorBoundary>
      <SessionSecurityInner>{children}</SessionSecurityInner>
    </SessionSecurityErrorBoundary>
  );
}

function SessionSecurityInner({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const lastActivityRef = useRef(Date.now());
  const [state, setState] = useState<SessionState>("active");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const stateRef = useRef<SessionState>("active");

  // Keep stateRef in sync for use in event handlers
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // ── Activity handler ──────────────────────────────────────────
  const recordActivity = useCallback(() => {
    // Don't record activity while locked
    if (stateRef.current === "locked") return;

    const now = Date.now();
    lastActivityRef.current = now;
    try {
      localStorage.setItem(STORAGE_KEY_LAST_ACTIVITY, String(now));
    } catch {
      // localStorage may not be available
    }
  }, []);

  // ── Reset from warning ────────────────────────────────────────
  const handleStayActive = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    setState("active");
    stateRef.current = "active";
    try {
      localStorage.setItem(STORAGE_KEY_LAST_ACTIVITY, String(now));
    } catch {}
  }, []);

  // ── Unlock handler ────────────────────────────────────────────
  const handleUnlock = useCallback(
    async (password: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const res = await fetch("/api/auth/verify-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });

        if (res.status === 429) {
          return {
            success: false,
            error: "Too many attempts. Please wait a moment.",
          };
        }

        const data = await res.json();

        if (!res.ok || !data.success) {
          return { success: false, error: data.error || "Invalid password" };
        }

        // Unlock: reset everything
        const now = Date.now();
        lastActivityRef.current = now;
        setState("active");
        stateRef.current = "active";
        try {
          localStorage.setItem(STORAGE_KEY_LAST_ACTIVITY, String(now));
          localStorage.setItem(STORAGE_KEY_SESSION_LOCKED, "false");
        } catch {}

        return { success: true };
      } catch {
        return { success: false, error: "Network error. Please try again." };
      }
    },
    []
  );

  // ── Logout handler ────────────────────────────────────────────
  const handleLogout = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY_LAST_ACTIVITY);
      localStorage.removeItem(STORAGE_KEY_SESSION_LOCKED);
      localStorage.removeItem(STORAGE_KEY_SESSION_START);
    } catch {}
    signOut({ callbackUrl: "/login" });
  }, []);

  // ── Main effect: activity listeners, timer, cross-tab sync ────
  useEffect(() => {
    // Don't activate until session is loaded
    if (status === "loading") return;

    // Initialize session start timestamp (persists across refreshes)
    try {
      if (!localStorage.getItem(STORAGE_KEY_SESSION_START)) {
        localStorage.setItem(STORAGE_KEY_SESSION_START, String(Date.now()));
      }
    } catch {}

    // Check for persisted lock state (e.g., page refresh while locked)
    try {
      if (localStorage.getItem(STORAGE_KEY_SESSION_LOCKED) === "true") {
        setState("locked");
        stateRef.current = "locked";
      }
    } catch {}

    // Initialize last activity from localStorage if present (preserves idle
    // state across reloads). Otherwise seed with now.
    try {
      const persisted = localStorage.getItem(STORAGE_KEY_LAST_ACTIVITY);
      if (persisted) {
        lastActivityRef.current = Number(persisted);
      } else {
        recordActivity();
      }
    } catch {
      recordActivity();
    }

    // ── Activity event listeners ──
    function handleActivity() {
      if (stateRef.current === "locked") return;
      const now = Date.now();
      lastActivityRef.current = now;
      try {
        localStorage.setItem(STORAGE_KEY_LAST_ACTIVITY, String(now));
      } catch {}
    }

    // NOTE: visibility change must NOT reset lastActivity — otherwise
    // laptop sleep + tab refocus silently wipes the idle timer, and the
    // 20-min lock / 60-min logout clocks never fire.
    // Instead, re-sync from localStorage (which may have been updated by
    // another tab or persists across sleeps) so the check interval sees
    // the correct elapsed time.
    function handleVisibility() {
      if (document.hidden) return;
      try {
        const persisted = localStorage.getItem(STORAGE_KEY_LAST_ACTIVITY);
        if (persisted) {
          const ts = Number(persisted);
          // Keep whichever is more recent — local ref may be ahead if this
          // tab has had recent activity that wasn't synced yet.
          if (ts > lastActivityRef.current) {
            lastActivityRef.current = ts;
          }
        }
      } catch {}
    }

    // ── Cross-tab sync ──
    function handleStorage(e: StorageEvent) {
      try {
        if (e.key === STORAGE_KEY_LAST_ACTIVITY && e.newValue) {
          const ts = Number(e.newValue);
          if (ts > lastActivityRef.current) {
            lastActivityRef.current = ts;
            // If another tab is active, this tab should also reset warning
            if (stateRef.current === "warning") {
              const elapsed = Date.now() - ts;
              if (elapsed < SESSION_LOCK_MS - SESSION_LOCK_WARNING_MS) {
                setState("active");
                stateRef.current = "active";
              }
            }
          }
        }

        if (e.key === STORAGE_KEY_SESSION_LOCKED) {
          if (e.newValue === "true" && stateRef.current !== "locked") {
            setState("locked");
            stateRef.current = "locked";
          }
          if (e.newValue === "false" && stateRef.current === "locked") {
            // Another tab unlocked — reset this tab
            lastActivityRef.current = Date.now();
            setState("active");
            stateRef.current = "active";
          }
        }
      } catch (err) {
        console.error("[SessionSecurity] Storage event error:", err);
      }
    }

    // Attach activity listeners
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handleActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("storage", handleStorage);

    // ── Main check interval ──
    const interval = setInterval(() => {
      try {
        const now = Date.now();
        const elapsed = now - lastActivityRef.current;

        // Max session lifetime check (client-side backup)
        try {
          const sessionStart = localStorage.getItem(STORAGE_KEY_SESSION_START);
          if (sessionStart) {
            const sessionAge = now - Number(sessionStart);
            if (sessionAge >= SESSION_MAX_LIFETIME_MS) {
              localStorage.removeItem(STORAGE_KEY_LAST_ACTIVITY);
              localStorage.removeItem(STORAGE_KEY_SESSION_LOCKED);
              localStorage.removeItem(STORAGE_KEY_SESSION_START);
              signOut({ callbackUrl: "/login?reason=max-session" });
              return;
            }
          }
        } catch {}

        // Hard logout: 60 min idle
        if (elapsed >= SESSION_HARD_LOGOUT_MS) {
          try {
            localStorage.removeItem(STORAGE_KEY_LAST_ACTIVITY);
            localStorage.removeItem(STORAGE_KEY_SESSION_LOCKED);
            localStorage.removeItem(STORAGE_KEY_SESSION_START);
          } catch {}
          signOut({ callbackUrl: "/login?reason=inactivity" });
          return;
        }

        // Lock: 20 min idle
        if (elapsed >= SESSION_LOCK_MS && stateRef.current !== "locked") {
          setState("locked");
          stateRef.current = "locked";
          try {
            localStorage.setItem(STORAGE_KEY_SESSION_LOCKED, "true");
          } catch {}
          return;
        }

        // Warning: 18-20 min idle (2 min before lock)
        if (
          elapsed >= SESSION_LOCK_MS - SESSION_LOCK_WARNING_MS &&
          stateRef.current === "active"
        ) {
          setState("warning");
          stateRef.current = "warning";
        }

        // Back to active if activity happened while in warning
        if (
          elapsed < SESSION_LOCK_MS - SESSION_LOCK_WARNING_MS &&
          stateRef.current === "warning"
        ) {
          setState("active");
          stateRef.current = "active";
        }
      } catch (err) {
        console.error("[SessionSecurity] Interval check error:", err);
      }
    }, SESSION_CHECK_INTERVAL_MS);

    // ── Countdown timer (1s) for warning/lock ──
    const countdownInterval = setInterval(() => {
      try {
        if (stateRef.current === "warning") {
          const elapsed = Date.now() - lastActivityRef.current;
          const remaining = Math.max(
            0,
            Math.ceil((SESSION_LOCK_MS - elapsed) / 1000)
          );
          setSecondsLeft(remaining);
          if (remaining <= 0) {
            setState("locked");
            stateRef.current = "locked";
            try {
              localStorage.setItem(STORAGE_KEY_SESSION_LOCKED, "true");
            } catch {}
          }
        }
      } catch (err) {
        console.error("[SessionSecurity] Countdown error:", err);
      }
    }, 1000);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handleActivity);
      }
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("storage", handleStorage);
      clearInterval(interval);
      clearInterval(countdownInterval);
    };
  }, [recordActivity, status]);

  return (
    <>
      {children}

      {state === "warning" && (
        <SessionWarningOverlay
          secondsLeft={secondsLeft}
          onStayActive={handleStayActive}
        />
      )}

      {state === "locked" && (
        <LockScreen
          userEmail={session?.user?.email ?? undefined}
          userName={session?.user?.name ?? undefined}
          onUnlock={handleUnlock}
          onLogout={handleLogout}
        />
      )}
    </>
  );
}

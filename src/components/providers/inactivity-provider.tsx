"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { signOut } from "next-auth/react";
import { InactivityWarning } from "./inactivity-warning";
import { SESSION_LOCK_MS as INACTIVITY_TIMEOUT_MS, SESSION_LOCK_WARNING_MS as INACTIVITY_WARNING_MS } from "@/lib/constants";

const STORAGE_KEY = "doorstax-last-activity";
const CHECK_INTERVAL = 15_000; // check every 15 seconds

export function InactivityProvider({ children }: { children: React.ReactNode }) {
  const lastActivityRef = useRef(Date.now());
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);

  const resetActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    setShowWarning(false);
    // Sync across tabs
    try {
      localStorage.setItem(STORAGE_KEY, String(now));
    } catch {
      // localStorage may not be available
    }
  }, []);

  useEffect(() => {
    // Activity events
    const events = ["mousemove", "mousedown", "keypress", "touchstart", "scroll"] as const;

    function handleActivity() {
      lastActivityRef.current = Date.now();
      try {
        localStorage.setItem(STORAGE_KEY, String(lastActivityRef.current));
      } catch {}
    }

    function handleVisibility() {
      if (!document.hidden) handleActivity();
    }

    // Cross-tab sync
    function handleStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY && e.newValue) {
        const ts = Number(e.newValue);
        if (ts > lastActivityRef.current) {
          lastActivityRef.current = ts;
          setShowWarning(false);
        }
      }
    }

    for (const event of events) {
      window.addEventListener(event, handleActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("storage", handleStorage);

    // Initialize
    handleActivity();

    // Check interval
    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;

      if (elapsed >= INACTIVITY_TIMEOUT_MS) {
        // Auto-logout
        clearInterval(interval);
        signOut({ callbackUrl: "/login?reason=inactivity" });
        return;
      }

      if (elapsed >= INACTIVITY_TIMEOUT_MS - INACTIVITY_WARNING_MS) {
        setShowWarning(true);
        const remaining = Math.max(0, Math.ceil((INACTIVITY_TIMEOUT_MS - elapsed) / 1000));
        setSecondsLeft(remaining);
      } else {
        setShowWarning(false);
      }
    }, CHECK_INTERVAL);

    // Faster countdown when warning is showing
    const countdownInterval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= INACTIVITY_TIMEOUT_MS - INACTIVITY_WARNING_MS) {
        const remaining = Math.max(0, Math.ceil((INACTIVITY_TIMEOUT_MS - elapsed) / 1000));
        setSecondsLeft(remaining);
        if (remaining <= 0) {
          signOut({ callbackUrl: "/login?reason=inactivity" });
        }
      }
    }, 1000);

    return () => {
      for (const event of events) {
        window.removeEventListener(event, handleActivity);
      }
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("storage", handleStorage);
      clearInterval(interval);
      clearInterval(countdownInterval);
    };
  }, []);

  return (
    <>
      {children}
      <InactivityWarning
        open={showWarning}
        secondsLeft={secondsLeft}
        onStayLoggedIn={resetActivity}
      />
    </>
  );
}

"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface InactivityWarningProps {
  open: boolean;
  secondsLeft: number;
  onStayLoggedIn: () => void;
}

export function InactivityWarning({
  open,
  secondsLeft,
  onStayLoggedIn,
}: InactivityWarningProps) {
  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Session Timeout</DialogTitle>
          <DialogDescription>
            You will be logged out in{" "}
            <span className="font-semibold text-foreground">{secondsLeft}</span>{" "}
            second{secondsLeft !== 1 ? "s" : ""} due to inactivity.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onStayLoggedIn}>Stay Logged In</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

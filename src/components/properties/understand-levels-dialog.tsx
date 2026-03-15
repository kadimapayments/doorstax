"use client";

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Info } from "lucide-react";
import { LEVELS, getLevel } from "@/lib/levels";
import { cn } from "@/lib/utils";

export function UnderstandLevelsDialog({ doors }: { doors: number }) {
  const current = getLevel(doors);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
          <Info className="h-3 w-3" />
          Understand Levels
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>DoorStax Level System</DialogTitle>
          <DialogDescription>
            Grow your portfolio to unlock higher levels. Every door counts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 mt-2">
          {LEVELS.map((level, i) => {
            const isCurrent = current.index === i + 1;
            const isReached = doors >= level.min;

            return (
              <div
                key={level.title}
                className={cn(
                  "flex items-center gap-3 rounded-lg p-3 transition-colors",
                  isCurrent && "bg-primary/10 border border-primary/30",
                  !isReached && !isCurrent && "opacity-50"
                )}
              >
                <span className="text-2xl shrink-0">{level.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">
                    Lv.{i + 1} {level.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {level.max === Infinity
                      ? `${level.min.toLocaleString()}+ doors`
                      : `${level.min.toLocaleString()} \u2013 ${level.max.toLocaleString()} doors`}
                  </p>
                </div>
                {isCurrent && (
                  <span className="text-[10px] font-bold gradient-text uppercase tracking-wider shrink-0">
                    You Are Here
                  </span>
                )}
                {isReached && !isCurrent && (
                  <span className="text-[10px] text-green-600 dark:text-green-400 font-medium shrink-0">
                    Unlocked
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Next level motivation */}
        {current.nextLevel && (
          <div className="mt-4 rounded-lg bg-primary/5 border border-primary/20 p-3 text-center">
            <p className="text-sm">
              <span className="font-bold">{(current.nextLevel.min - doors).toLocaleString()}</span>{" "}
              more door{current.nextLevel.min - doors !== 1 ? "s" : ""} to reach{" "}
              <span className="font-bold">
                {current.nextLevel.title} {current.nextLevel.emoji}
              </span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">Stack doors, get paid!</p>
          </div>
        )}

        {!current.nextLevel && (
          <div className="mt-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-center">
            <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
              You&apos;ve reached the top! Empire status unlocked.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
